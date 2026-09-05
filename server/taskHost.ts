import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import type { CodexTaskEvent, CodexTaskResult } from './codexAdapter';

const MAX_REQUEST_BYTES = 4_608;
const MAX_TASK_BYTES = 4 * 1024;
const SESSION_COOKIE = 'calcu_agent_session';
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

const SAFE_ERROR_CODES = new Set([
  'codex_not_found',
  'codex_auth_required',
  'codex_version_unsupported',
  'model_unavailable',
  'agent_timeout',
  'agent_protocol_error',
  'agent_process_exited',
  'tool_not_called',
  'tool_call_rejected',
  'multiple_tool_calls',
  'task_invalid',
  'task_busy',
  'cancelled',
  'backend_unavailable',
]);

export type TaskExecution = (
  task: string,
  signal: AbortSignal,
  onEvent: (event: CodexTaskEvent) => void,
) => Promise<CodexTaskResult>;

export type TaskHostOptions = {
  distDirectory: string;
  executeTask: TaskExecution;
  sessionToken?: string;
};

type BrowserEvent =
  | { type: 'task.accepted'; task_id: string }
  | { type: 'task.progress'; task_id: string; phase: string }
  | {
      type: 'task.tool_result';
      task_id: string;
      application_result: CodexTaskResult['application_result'];
      trace: CodexTaskResult['trace'];
    }
  | ({ type: 'task.completed'; task_id: string } & CodexTaskResult)
  | { type: 'task.failed'; task_id: string; error: { code: string } }
  | { type: 'task.cancelled'; task_id: string };

function applySecurityHeaders(response: ServerResponse) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('content-security-policy', CSP);
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  applySecurityHeaders(response);
  response.end(JSON.stringify(body));
}

function safeErrorCode(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'aborted') return 'cancelled';
  return SAFE_ERROR_CODES.has(code) ? code : 'backend_unavailable';
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readTask(request: IncomingMessage) {
  const contentLength = request.headers['content-length'];
  if (
    !contentLength ||
    !/^\d+$/.test(contentLength) ||
    Number(contentLength) > MAX_REQUEST_BYTES ||
    request.headers['transfer-encoding']
  )
    throw new Error('task_invalid');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.byteLength;
    if (size > MAX_REQUEST_BYTES) throw new Error('task_invalid');
    chunks.push(data);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('task_invalid');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('task_invalid');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.task !== 'string')
    throw new Error('task_invalid');
  const task = record.task.trim();
  if (!task || Buffer.byteLength(task) > MAX_TASK_BYTES)
    throw new Error('task_invalid');
  return task;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function serveStatic(
  distDirectory: string,
  request: IncomingMessage,
  response: ServerResponse,
  sessionToken: string,
) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    writeJson(response, 404, { error: { code: 'not_found' } });
    return;
  }
  const requested = request.url === '/' ? '/index.html' : (request.url ?? '');
  if (requested.includes('?') || requested.includes('#')) {
    writeJson(response, 404, { error: { code: 'not_found' } });
    return;
  }
  let pathname: string;
  try {
    pathname = normalize(decodeURIComponent(requested)).replace(
      /^([/\\])+/,
      '',
    );
  } catch {
    writeJson(response, 404, { error: { code: 'not_found' } });
    return;
  }
  const root = resolve(distDirectory);
  const filePath = resolve(join(root, pathname));
  if (!filePath.startsWith(`${root}/`) && filePath !== root) {
    writeJson(response, 404, { error: { code: 'not_found' } });
    return;
  }
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('not_file');
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader(
      'content-type',
      CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    );
    response.setHeader('cache-control', 'no-store');
    response.setHeader(
      'set-cookie',
      `${SESSION_COOKIE}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`,
    );
    applySecurityHeaders(response);
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch {
    writeJson(response, 404, { error: { code: 'not_found' } });
  }
}

export function createTaskHttpServer(options: TaskHostOptions) {
  const sessionToken =
    options.sessionToken ?? randomBytes(32).toString('base64url');
  let activeTask: { taskId: string; controller: AbortController } | undefined;

  const server = createServer(async (request, response) => {
    const address = server.address();
    const expectedHost =
      address && typeof address !== 'string'
        ? `127.0.0.1:${address.port}`
        : undefined;
    if (!expectedHost || request.headers.host !== expectedHost) {
      writeJson(response, 403, { error: { code: 'unauthorized' } });
      return;
    }
    if (request.url !== '/api/tasks/run') {
      await serveStatic(options.distDirectory, request, response, sessionToken);
      return;
    }
    if (
      request.method !== 'POST' ||
      request.headers['content-type']?.split(';')[0] !== 'application/json' ||
      request.headers.origin !== `http://${expectedHost}`
    ) {
      writeJson(response, 403, { error: { code: 'unauthorized' } });
      return;
    }
    const cookie = request.headers.cookie ?? '';
    const suppliedToken = cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    if (!suppliedToken || !secureEqual(suppliedToken, sessionToken)) {
      writeJson(response, 403, { error: { code: 'unauthorized' } });
      return;
    }
    if (activeTask) {
      writeJson(response, 409, { error: { code: 'task_busy' } });
      return;
    }
    const taskId = randomUUID();
    const controller = new AbortController();
    activeTask = { taskId, controller };
    let task: string;
    try {
      task = await readTask(request);
    } catch {
      if (activeTask?.taskId === taskId) activeTask = undefined;
      writeJson(response, 400, { error: { code: 'task_invalid' } });
      return;
    }
    let terminal = false;
    response.statusCode = 200;
    response.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('connection', 'keep-alive');
    applySecurityHeaders(response);
    const send = (event: BrowserEvent) => {
      if (!response.destroyed && !response.writableEnded)
        response.write(`${JSON.stringify(event)}\n`);
    };
    response.once('close', () => {
      if (!terminal && !response.writableEnded) controller.abort();
    });
    send({ type: 'task.accepted', task_id: taskId });

    try {
      const result = await options.executeTask(
        task,
        controller.signal,
        (event) => {
          if (event.type === 'progress') {
            send({
              type: 'task.progress',
              task_id: taskId,
              phase: event.phase,
            });
          } else {
            send({
              type: 'task.tool_result',
              task_id: taskId,
              application_result: event.result,
              trace: event.trace,
            });
          }
        },
      );
      terminal = true;
      send({
        type: 'task.completed',
        task_id: taskId,
        application_result: result.application_result,
        ...(result.agent_message
          ? { agent_message: result.agent_message }
          : {}),
        trace: result.trace,
      });
      response.end();
    } catch (error) {
      terminal = true;
      const code = safeErrorCode(error);
      if (code === 'cancelled')
        send({ type: 'task.cancelled', task_id: taskId });
      else send({ type: 'task.failed', task_id: taskId, error: { code } });
      response.end();
    } finally {
      if (activeTask?.taskId === taskId) activeTask = undefined;
    }
  });

  return {
    server,
    sessionToken,
    listen: () =>
      new Promise<Server>((resolvePromise, rejectPromise) => {
        server.once('error', rejectPromise);
        server.listen(0, '127.0.0.1', () => {
          server.removeListener('error', rejectPromise);
          resolvePromise(server);
        });
      }),
    cancelActiveTask() {
      activeTask?.controller.abort();
    },
  };
}

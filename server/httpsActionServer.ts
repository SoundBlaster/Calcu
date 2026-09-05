import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:https';
import type { createCalcuExecutor } from './executor';

const MAX_BODY_BYTES = 8192;
const MAX_RESPONSE_BYTES = 8192;
const ERROR_CODES = new Set([
  'unauthorized',
  'binding_mismatch',
  'action_not_allowed',
  'schema_invalid',
  'quota_exceeded',
  'identity_evidence_invalid',
  'identity_evidence_profile_unsupported',
  'identity_evidence_expired',
  'identity_evidence_revoked',
  'identity_evidence_unknown',
  'identity_evidence_unavailable',
  'integrity_mismatch',
  'audience_mismatch',
]);

type Executor = ReturnType<typeof createCalcuExecutor>;

export type ActionHttpsServerOptions = {
  key: string | Buffer;
  cert: string | Buffer;
  port?: number;
  /** Test-only delay used to exercise timeout and AbortSignal handling. */
  invokeDelayMs?: number;
};

function errorCode(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return ERROR_CODES.has(code) ? code : 'action_rejected';
}

function writeError(
  response: ServerResponse,
  statusCode: number,
  code: string,
) {
  const body = JSON.stringify({ type: 'action.error', error: { code } });
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.end(body);
}

async function readBody(request: IncomingMessage) {
  const contentLength = request.headers['content-length'];
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
  )
    throw new Error('schema_invalid');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error('schema_invalid');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function handler(
  executor: Executor,
  request: IncomingMessage,
  response: ServerResponse,
  expectedHosts: readonly string[],
  invokeDelayMs = 0,
) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  if (request.method !== 'POST' || request.url !== '/agent-actions') {
    writeError(response, 404, 'action_not_allowed');
    return;
  }
  if (!expectedHosts.includes(request.headers.host ?? '')) {
    writeError(response, 403, 'unauthorized');
    return;
  }
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    writeError(response, 415, 'schema_invalid');
    return;
  }
  if (request.headers['transfer-encoding']) {
    writeError(response, 400, 'schema_invalid');
    return;
  }
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ') || authorization.length <= 7) {
    writeError(response, 401, 'unauthorized');
    return;
  }
  const credential = authorization.slice(7);
  readBody(request)
    .then(
      (body) =>
        new Promise<string>((resolve, reject) => {
          if (invokeDelayMs <= 0) {
            resolve(body);
            return;
          }
          setTimeout(() => {
            if (request.destroyed || response.destroyed) {
              reject(new Error('transport_error'));
              return;
            }
            resolve(body);
          }, invokeDelayMs);
        }),
    )
    .then((body) => executor.invoke(credential, body))
    .then((body) => {
      if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
        writeError(response, 500, 'response_too_large');
        return;
      }
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(body);
    })
    .catch((error: unknown) => {
      const code = errorCode(error);
      const status =
        code === 'unauthorized'
          ? 401
          : code === 'action_not_allowed'
            ? 403
            : 400;
      writeError(response, status, code);
    });
}

export function createActionHttpsServer(
  executor: Executor,
  options: ActionHttpsServerOptions,
) {
  const server = createServer(
    { key: options.key, cert: options.cert },
    (request, response) => {
      const address = server.address();
      const expectedHosts =
        address && typeof address !== 'string'
          ? [
              `127.0.0.1:${address.port}`,
              ...(address.port === 443 ? ['127.0.0.1'] : []),
            ]
          : ['127.0.0.1'];
      handler(
        executor,
        request,
        response,
        expectedHosts,
        options.invokeDelayMs,
      );
    },
  );
  return {
    server,
    listen: () =>
      new Promise<Server>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 0, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve(server);
        });
      }),
  };
}

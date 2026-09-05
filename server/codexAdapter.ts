import {
  type ChildProcessWithoutNullStreams,
  execFile as execFileCallback,
  type SpawnOptionsWithoutStdio,
  spawn,
} from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export const CODEX_VERSION = '0.145.0';
export const CODEX_MODEL = 'gpt-5.6-luna';
export const CODEX_EFFORT = 'low';
export const MAX_TASK_BYTES = 4 * 1024;
export const MAX_PROTOCOL_LINE_BYTES = 256 * 1024;
export const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
export const MAX_AGENT_MESSAGE_BYTES = 8 * 1024;

const OPTIONAL_FEATURES = [
  'shell_tool',
  'unified_exec',
  'apps',
  'plugins',
  'hooks',
  'multi_agent',
  'browser_use',
  'computer_use',
  'image_generation',
  'code_mode',
  'code_mode_host',
  'workspace_dependencies',
  'skill_search',
  'memories',
  'enable_request_compression',
] as const;

const ALLOWED_ENVIRONMENT = [
  'PATH',
  'HOME',
  'CODEX_HOME',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
] as const;

export type CalculationArguments = {
  operator: 'add' | 'subtract' | 'multiply' | 'divide';
  left: number;
  right: number;
};

export type CalculationResult = CalculationArguments & { result: number };

export type CalculationBackend = {
  calculationPropose(
    input: unknown,
    signal?: AbortSignal,
  ): Promise<CalculationResult>;
};

export type SafeTaskTrace = {
  model: typeof CODEX_MODEL;
  effort: typeof CODEX_EFFORT;
  tool_name: 'calculation_propose';
  call_id: string;
  operands: CalculationArguments;
};

export type CodexTaskResult = {
  application_result: CalculationResult;
  agent_message?: string;
  trace: SafeTaskTrace;
};

export type CodexTaskEvent =
  | { type: 'progress'; phase: 'starting' | 'thinking' | 'calling_tool' }
  | { type: 'tool_result'; result: CalculationResult; trace: SafeTaskTrace };

export type CodexTaskRunner = {
  run(
    task: string,
    backend: CalculationBackend,
    signal: AbortSignal,
    onEvent: (event: CodexTaskEvent) => void,
  ): Promise<CodexTaskResult>;
};

type SpawnCodex = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export type CodexTaskAdapterOptions = {
  command?: string;
  timeoutMs?: number;
  verifyVersion?: () => Promise<string>;
  spawnCodex?: SpawnCodex;
  environment?: NodeJS.ProcessEnv;
  appServerArgs?: readonly string[];
  /** Test-only override; production keeps the one-second SIGTERM grace. */
  killGraceMs?: number;
  onDiagnostic?: (event: {
    stage: 'protocol_event' | 'protocol_error' | 'turn_failed';
    status?: string;
    message?: string;
  }) => void;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('agent_protocol_error');
  return value as JsonObject;
}

function identifier(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 256)
    throw new Error('agent_protocol_error');
  return value;
}

function allowlistedEnvironment(source: NodeJS.ProcessEnv) {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ALLOWED_ENVIRONMENT) {
    const value = source[key];
    if (value) environment[key] = value;
  }
  return environment;
}

function defaultAppServerArgs() {
  const args = ['app-server', '--stdio'];
  for (const feature of OPTIONAL_FEATURES) args.push('--disable', feature);
  args.push('-c', 'web_search="disabled"');
  return args;
}

function dynamicTool() {
  return {
    type: 'function',
    name: 'calculation_propose',
    description:
      'Propose one arithmetic calculation through the Calcu application boundary.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['operator', 'left', 'right'],
      properties: {
        operator: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        left: { type: 'number' },
        right: { type: 'number' },
      },
    },
    deferLoading: false,
  };
}

function appendBoundedMessage(current: string, delta: string) {
  const remaining = MAX_AGENT_MESSAGE_BYTES - Buffer.byteLength(current);
  if (remaining <= 0) return current;
  return current + Buffer.from(delta).subarray(0, remaining).toString('utf8');
}

async function defaultVersionCheck(
  command: string,
  environment: NodeJS.ProcessEnv,
) {
  try {
    const { stdout } = await execFile(command, ['--version'], {
      env: allowlistedEnvironment(environment),
      timeout: 5_000,
      maxBuffer: 16 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      code === 'ENOENT' ? 'codex_not_found' : 'codex_version_unsupported',
    );
  }
}

function verifyVersionText(value: string) {
  const match = /^codex-cli (\S+)$/.exec(value.trim());
  if (!match || match[1] !== CODEX_VERSION)
    throw new Error('codex_version_unsupported');
}

function classifyCodexFailure(message: string | undefined) {
  const value = message?.toLowerCase() ?? '';
  if (
    value.includes('not logged in') ||
    value.includes('authentication') ||
    value.includes('unauthorized') ||
    value.includes('api key')
  )
    return 'codex_auth_required';
  if (
    value.includes('model') &&
    (value.includes('not found') ||
      value.includes('unavailable') ||
      value.includes('access'))
  )
    return 'model_unavailable';
  return 'agent_protocol_error';
}

function createProcessStopper(
  child: ChildProcessWithoutNullStreams,
  killGraceMs: number,
) {
  let stopping: Promise<void> | undefined;
  return () => {
    if (stopping) return stopping;
    stopping = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (killTimer) clearTimeout(killTimer);
        child.removeListener('close', finish);
        resolve();
      };
      const signalGroup = (signal: NodeJS.Signals) => {
        try {
          if (process.platform === 'win32') child.kill(signal);
          else if (child.pid) {
            process.kill(-child.pid, signal);
            // Also signal the group leader directly: on macOS a just-spawned
            // detached process may not yet observe the group signal.
            child.kill(signal);
          }
        } catch {
          if (!child.kill(signal)) finish();
        }
      };
      child.once('close', finish);
      signalGroup('SIGTERM');
      killTimer = setTimeout(() => {
        signalGroup('SIGKILL');
        setTimeout(finish, 100).unref();
      }, killGraceMs);
      killTimer.unref();
    });
    return stopping;
  };
}

export class CodexTaskAdapter implements CodexTaskRunner {
  readonly #command: string;
  readonly #timeoutMs: number;
  readonly #verifyVersion: () => Promise<string>;
  readonly #spawnCodex: SpawnCodex;
  readonly #environment: NodeJS.ProcessEnv;
  readonly #appServerArgs: readonly string[];
  readonly #killGraceMs: number;
  readonly #onDiagnostic?: CodexTaskAdapterOptions['onDiagnostic'];

  constructor(options: CodexTaskAdapterOptions = {}) {
    if (process.platform === 'win32') throw new Error('platform_unsupported');
    this.#command = options.command ?? 'codex';
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    if (
      !Number.isInteger(this.#timeoutMs) ||
      this.#timeoutMs < 1 ||
      this.#timeoutMs > 30_000
    )
      throw new Error('task_timeout_invalid');
    this.#environment = options.environment ?? process.env;
    this.#verifyVersion =
      options.verifyVersion ??
      (() => defaultVersionCheck(this.#command, this.#environment));
    this.#spawnCodex =
      options.spawnCodex ??
      ((command, args, spawnOptions) =>
        spawn(command, [...args], {
          ...spawnOptions,
          stdio: ['pipe', 'pipe', 'pipe'],
        }));
    this.#appServerArgs = options.appServerArgs ?? defaultAppServerArgs();
    this.#onDiagnostic = options.onDiagnostic;
    this.#killGraceMs = options.killGraceMs ?? 1_000;
    if (
      !Number.isInteger(this.#killGraceMs) ||
      this.#killGraceMs < 1 ||
      this.#killGraceMs > 1_000
    )
      throw new Error('task_timeout_invalid');
  }

  async run(
    task: string,
    backend: CalculationBackend,
    signal: AbortSignal,
    onEvent: (event: CodexTaskEvent) => void,
  ): Promise<CodexTaskResult> {
    if (
      typeof task !== 'string' ||
      !task.trim() ||
      Buffer.byteLength(task) > MAX_TASK_BYTES
    )
      throw new Error('task_invalid');
    if (signal.aborted) throw new Error('cancelled');
    verifyVersionText(await this.#verifyVersion());

    const workingDirectory = await mkdtemp(join(tmpdir(), 'calcu-codex-task-'));
    let child: ChildProcessWithoutNullStreams | undefined;
    try {
      const environment = allowlistedEnvironment(this.#environment);
      child = this.#spawnCodex(this.#command, this.#appServerArgs, {
        cwd: workingDirectory,
        env: {
          ...environment,
          TMPDIR: workingDirectory,
        },
        detached: true,
      });
      const stopProcess = createProcessStopper(child, this.#killGraceMs);
      const send = (message: unknown) => {
        if (!child?.stdin.writable) throw new Error('agent_process_exited');
        child.stdin.write(`${JSON.stringify(message)}\n`);
      };

      return await new Promise<CodexTaskResult>((resolve, reject) => {
        let settled = false;
        let stdoutBytes = 0;
        let buffer = Buffer.alloc(0);
        let threadId: string | undefined;
        let turnId: string | undefined;
        let toolCalls = 0;
        let toolResult: CalculationResult | undefined;
        let trace: SafeTaskTrace | undefined;
        let agentMessage = '';
        let queue = Promise.resolve();

        const cleanup = () => {
          clearTimeout(timeout);
          signal.removeEventListener('abort', abort);
          child?.stdout.removeAllListeners();
          child?.stderr.removeAllListeners();
        };
        const settle = (error?: Error, result?: CodexTaskResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          void stopProcess().then(() => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error('agent_protocol_error'));
          });
        };
        const fail = (code: string) => settle(new Error(code));
        const abort = () => fail('cancelled');
        const timeout = setTimeout(
          () => fail('agent_timeout'),
          this.#timeoutMs,
        );
        timeout.unref();
        signal.addEventListener('abort', abort, { once: true });

        const processMessage = async (value: unknown) => {
          if (settled) return;
          const message = object(value);
          this.#onDiagnostic?.({
            stage: 'protocol_event',
            message: `id=${String(message.id ?? '')} method=${String(message.method ?? '')}`,
          });
          if ('error' in message) {
            const error = object(message.error);
            this.#onDiagnostic?.({
              stage: 'protocol_error',
              message:
                typeof error.message === 'string'
                  ? error.message.slice(0, 512)
                  : undefined,
            });
            throw new Error(
              classifyCodexFailure(
                typeof error.message === 'string' ? error.message : undefined,
              ),
            );
          }

          if (message.id === 0 && !message.method) {
            object(message.result);
            send({ method: 'initialized', params: {} });
            send({
              id: 1,
              method: 'thread/start',
              params: {
                model: CODEX_MODEL,
                cwd: workingDirectory,
                ephemeral: true,
                approvalPolicy: 'never',
                sandbox: 'read-only',
                environments: [],
                dynamicTools: [dynamicTool()],
                selectedCapabilityRoots: [],
                allowProviderModelFallback: false,
              },
            });
            return;
          }
          if (message.id === 1 && !message.method) {
            const result = object(message.result);
            threadId = identifier(object(result.thread).id);
            send({
              id: 2,
              method: 'turn/start',
              params: {
                threadId,
                environments: [],
                effort: CODEX_EFFORT,
                model: CODEX_MODEL,
                input: [
                  {
                    type: 'text',
                    text: `${task}\nUse calculation_propose exactly once. The application result is authoritative.`,
                  },
                ],
              },
            });
            onEvent({ type: 'progress', phase: 'thinking' });
            return;
          }
          if (message.id === 2 && !message.method) {
            const result = object(message.result);
            turnId = identifier(object(result.turn).id);
            return;
          }
          if (message.method === 'item/tool/call') {
            if (message.id === undefined)
              throw new Error('agent_protocol_error');
            const params = object(message.params);
            const receivedThread = identifier(params.threadId);
            const receivedTurn = identifier(params.turnId);
            const callId = identifier(params.callId);
            if (
              !threadId ||
              !turnId ||
              receivedThread !== threadId ||
              receivedTurn !== turnId ||
              params.tool !== 'calculation_propose' ||
              params.namespace !== null ||
              toolCalls !== 0
            ) {
              send({
                id: message.id,
                result: {
                  success: false,
                  contentItems: [
                    { type: 'inputText', text: 'Request rejected' },
                  ],
                },
              });
              throw new Error(
                toolCalls > 0 ? 'multiple_tool_calls' : 'tool_call_rejected',
              );
            }
            toolCalls += 1;
            onEvent({ type: 'progress', phase: 'calling_tool' });
            const result = await backend.calculationPropose(
              params.arguments,
              signal,
            );
            const operands: CalculationArguments = {
              operator: result.operator,
              left: result.left,
              right: result.right,
            };
            trace = {
              model: CODEX_MODEL,
              effort: CODEX_EFFORT,
              tool_name: 'calculation_propose',
              call_id: callId,
              operands,
            };
            toolResult = result;
            onEvent({ type: 'tool_result', result, trace });
            send({
              id: message.id,
              result: {
                success: true,
                contentItems: [
                  { type: 'inputText', text: JSON.stringify(result) },
                ],
              },
            });
            return;
          }
          if (message.method === 'item/agentMessage/delta') {
            const params = object(message.params);
            if (
              identifier(params.threadId) !== threadId ||
              identifier(params.turnId) !== turnId ||
              typeof params.delta !== 'string'
            )
              throw new Error('agent_protocol_error');
            agentMessage = appendBoundedMessage(agentMessage, params.delta);
            return;
          }
          if (message.method === 'turn/completed') {
            const params = object(message.params);
            const turn = object(params.turn);
            if (
              identifier(params.threadId) !== threadId ||
              identifier(turn.id) !== turnId
            )
              throw new Error('agent_protocol_error');
            if (turn.status !== 'completed') {
              const turnError = turn.error ? object(turn.error) : {};
              this.#onDiagnostic?.({
                stage: 'turn_failed',
                status:
                  typeof turn.status === 'string' ? turn.status : undefined,
                message:
                  typeof turnError.message === 'string'
                    ? turnError.message.slice(0, 512)
                    : undefined,
              });
              throw new Error(
                classifyCodexFailure(
                  typeof turnError.message === 'string'
                    ? turnError.message
                    : undefined,
                ),
              );
            }
            if (toolCalls !== 1 || !toolResult || !trace)
              throw new Error('tool_not_called');
            settle(undefined, {
              application_result: toolResult,
              ...(agentMessage.trim()
                ? { agent_message: agentMessage.trim() }
                : {}),
              trace,
            });
            return;
          }
          if (message.method === 'error') {
            const params = object(message.params);
            throw new Error(
              classifyCodexFailure(
                typeof params.message === 'string' ? params.message : undefined,
              ),
            );
          }
          if ('id' in message && 'method' in message) {
            send({
              id: message.id,
              error: { code: -32601, message: 'Method not supported' },
            });
            throw new Error('agent_protocol_error');
          }
        };

        child?.stdout.on('data', (chunk: Buffer | string) => {
          if (settled) return;
          const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          stdoutBytes += data.byteLength;
          if (stdoutBytes > MAX_STDOUT_BYTES) {
            fail('agent_protocol_error');
            return;
          }
          buffer = Buffer.concat([buffer, data]);
          while (true) {
            const newline = buffer.indexOf(0x0a);
            if (newline < 0) break;
            const line = buffer.subarray(0, newline);
            buffer = buffer.subarray(newline + 1);
            if (line.byteLength > MAX_PROTOCOL_LINE_BYTES) {
              fail('agent_protocol_error');
              return;
            }
            if (!line.length) continue;
            queue = queue
              .then(() => {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(line.toString('utf8'));
                } catch {
                  throw new Error('agent_protocol_error');
                }
                return processMessage(parsed);
              })
              .catch((error: unknown) =>
                fail(
                  error instanceof Error
                    ? error.message
                    : 'agent_protocol_error',
                ),
              );
          }
          if (buffer.byteLength > MAX_PROTOCOL_LINE_BYTES)
            fail('agent_protocol_error');
        });
        child?.stderr.on('data', () => {
          // Diagnostics are intentionally not forwarded to the browser or logs.
        });
        child?.once('error', (error: NodeJS.ErrnoException) =>
          fail(
            error.code === 'ENOENT'
              ? 'codex_not_found'
              : 'agent_process_exited',
          ),
        );
        child?.once('close', () => {
          if (!settled)
            fail(
              buffer.byteLength
                ? 'agent_protocol_error'
                : 'agent_process_exited',
            );
        });

        onEvent({ type: 'progress', phase: 'starting' });
        try {
          send({
            id: 0,
            method: 'initialize',
            params: {
              clientInfo: { name: 'calcu_agent_task', version: '0.1.0' },
              capabilities: { experimentalApi: true },
            },
          });
        } catch {
          fail('agent_process_exited');
        }
      });
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}

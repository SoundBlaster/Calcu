// Offline provider capture: sends no requests to OpenAI and reads no credentials.
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { inspectRequest, prepareFixture } from './fixture.mjs';

if (process.platform === 'win32') {
  throw new Error(
    'This probe requires POSIX process-group cleanup; Windows is not supported.',
  );
}

const dir = await prepareFixture();
const cwd = join(dir, 'work');
const home = join(dir, 'home');
await mkdir(cwd);
await mkdir(home);

let captured;
const server = createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > 2_000_000) request.destroy();
  });
  request.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed.input)) captured = parsed;
    } catch {
      /* Only a Responses request is evidence. */
    }
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        error: {
          message: 'Offline capture complete',
          type: 'invalid_request_error',
        },
      }),
    );
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const settings = {
  model_provider: 'capture',
  'model_providers.capture.name': 'Offline capture',
  'model_providers.capture.base_url': `http://127.0.0.1:${server.address().port}/v1`,
  'model_providers.capture.wire_api': 'responses',
  'model_providers.capture.requires_openai_auth': false,
  'model_providers.capture.request_max_retries': 0,
  'model_providers.capture.stream_max_retries': 0,
  model_reasoning_effort: 'low',
  web_search: 'disabled',
  'mcp_servers.calcu.command': process.execPath,
  'mcp_servers.calcu.args': [join(dir, 'server.mjs')],
  'mcp_servers.calcu.required': true,
  'mcp_servers.calcu.enabled_tools': ['calculation_propose'],
};
const args = [
  '-a',
  'never',
  'exec',
  '--ignore-user-config',
  '--ignore-rules',
  '--ephemeral',
  '--skip-git-repo-check',
  '--sandbox',
  'read-only',
  '--json',
  '-m',
  'gpt-5.6-luna',
  '-C',
  cwd,
];
// Disable known optional capability paths; the captured tool list is the gate.
for (const feature of [
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
]) {
  args.push('--disable', feature);
}
for (const [key, value] of Object.entries(settings))
  args.push('-c', `${key}=${JSON.stringify(value)}`);
args.push('-');
let child;
let timer;
const appServer = process.argv.includes('--app-server');
try {
  const launchArgs = appServer
    ? ['app-server', '--stdio', ...args.slice(args.indexOf('--disable'), -1)]
    : args;
  child = spawn('codex', launchArgs, {
    env: { PATH: process.env.PATH, HOME: home, CODEX_HOME: home, TMPDIR: dir },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  let diagnostics = '';
  let protocolBuffer = '';
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  child.stdout.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-12000);
    if (!appServer) return;
    protocolBuffer += chunk;
    if (protocolBuffer.length > 2_000_000) {
      child.kill('SIGKILL');
      return;
    }
    while (protocolBuffer.includes('\n')) {
      const end = protocolBuffer.indexOf('\n');
      const line = protocolBuffer.slice(0, end);
      protocolBuffer = protocolBuffer.slice(end + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        child.kill('SIGKILL');
        return;
      }
      if (message.error) {
        child.kill('SIGKILL');
        return;
      }
      if (message.id === 0) {
        send({ method: 'initialized', params: {} });
        send({
          id: 1,
          method: 'thread/start',
          params: {
            model: 'gpt-5.6-luna',
            modelProvider: 'capture',
            cwd,
            ephemeral: true,
            approvalPolicy: 'never',
            sandbox: 'read-only',
            environments: [],
            allowProviderModelFallback: false,
          },
        });
      } else if (message.id === 1) {
        send({
          id: 2,
          method: 'turn/start',
          params: {
            threadId: message.result.thread.id,
            environments: [],
            effort: 'low',
            input: [
              {
                type: 'text',
                text: 'Сколько будет 15% от 240? Use the Calcu tool.',
              },
            ],
          },
        });
      } else if (message.method === 'turn/completed') {
        child.stdin.end();
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-12000);
  });
  timer = setTimeout(() => {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* Already exited. */
      }
    }
  }, 30000);
  child.stdin.on('error', () => {});
  if (appServer)
    send({
      id: 0,
      method: 'initialize',
      params: {
        clientInfo: { name: 'calcu_preflight', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      },
    });
  else child.stdin.end('Сколько будет 15% от 240? Use the Calcu tool.');
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (!captured)
    throw new Error(
      `No provider request captured (exit ${code}): ${diagnostics}`,
    );
  const assessment = inspectRequest(captured);
  console.log(
    JSON.stringify(
      {
        mode: appServer ? 'offline_app_server_capture' : 'offline_capture',
        ...assessment,
        liveModelTested: false,
        aspConformance: false,
        mcpEvents: await readFile(join(dir, 'mcp-events.jsonl'), 'utf8').catch(
          () => 'not_started',
        ),
      },
      null,
      2,
    ),
  );
  process.exitCode = assessment.initialRequestGatePassed ? 0 : 1;
} finally {
  clearTimeout(timer);
  if (child?.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* Already exited. */
    }
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}

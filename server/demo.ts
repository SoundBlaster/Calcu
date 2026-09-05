import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { CodexTaskAdapter } from './codexAdapter';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { createCalcuExecutor, surface } from './executor';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createDevelopmentIdentityVerifier,
  createEphemeralDevelopmentIdentity,
} from './identity';
import { createLocalBackend } from './localBackend';
import { createTaskHttpServer } from './taskHost';
import { createAuthenticatedHttpsTransport } from './transport';

async function closeServer(server: import('node:http').Server) {
  if (!server.listening) return;
  await new Promise<void>((resolvePromise) =>
    server.close(() => resolvePromise()),
  );
}

async function main() {
  const tls = await createDevelopmentTlsMaterial();
  const identity = createEphemeralDevelopmentIdentity();
  const executor = createCalcuExecutor({
    identityVerifier: createDevelopmentIdentityVerifier(identity),
  });
  const actionHost = createActionHttpsServer(executor, {
    key: tls.key,
    cert: tls.cert,
  });
  await actionHost.listen();
  const actionAddress = actionHost.server.address() as AddressInfo;
  const adapter = new CodexTaskAdapter({
    ...(process.env.CALCU_AGENT_DEBUG === '1'
      ? {
          onDiagnostic: (event: object) =>
            process.stderr.write(
              `Codex diagnostic: ${JSON.stringify(event)}\n`,
            ),
        }
      : {}),
  });
  const taskHost = createTaskHttpServer({
    distDirectory: resolve('dist'),
    async executeTask(task, signal, onEvent) {
      const access = executor.issue({
        subject: { user: 'calcu-demo-user' },
        delegate: {
          runtime: 'calcu-local-task-host',
          agent: identity.evidence.subject,
        },
        identity: {
          evidence: identity.evidence,
          artifactBytes: identity.artifactBytes,
        },
        audience: surface.credential_audience,
        expires_at: Date.now() + 60_000,
      });
      const transport = createAuthenticatedHttpsTransport({
        endpoint: `https://127.0.0.1:${actionAddress.port}/agent-actions`,
        ca: tls.cert,
        timeoutMs: 5_000,
      });
      const backend = createLocalBackend(access, transport);
      try {
        return await adapter.run(task, backend, signal, onEvent);
      } finally {
        executor.revoke(access.binding.grant_id);
      }
    },
  });
  await taskHost.listen();
  const taskAddress = taskHost.server.address() as AddressInfo;
  const url = `http://127.0.0.1:${taskAddress.port}/`;
  process.stdout.write(`Calcu agent demo: ${url}\n`);

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    taskHost.cancelActiveTask();
    await closeServer(taskHost.server);
    await closeServer(actionHost.server);
    await tls.dispose();
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
}

main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message : 'demo_start_failed';
  process.stderr.write(`Calcu agent demo failed: ${code}\n`);
  process.exitCode = 1;
});

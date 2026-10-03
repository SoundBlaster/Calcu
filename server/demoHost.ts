import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { CodexTaskAdapter, type CodexTaskRunner } from './codexAdapter';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { createCalcuExecutor } from './executor';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createDevelopmentIdentityVerifier,
  createEphemeralDevelopmentIdentity,
} from './identity';
import { createInlineProposalBackend } from './inlineProposalBackend';
import { createLocalBackend } from './localBackend';
import {
  type PreparedCalcuSurface,
  prepareInlineCalcuSurface,
} from './manifest';
import { createTaskHttpServer } from './taskHost';
import {
  createTaskPermissionBroker,
  issuePermittedTaskGrant,
} from './taskPermissions';
import { createAuthenticatedHttpsTransport } from './transport';

export type DemoHostOptions = {
  distDirectory?: string;
  adapter?: CodexTaskRunner;
  /** Trusted composition/testing seams, never browser API parameters. */
  prepareSurface?: () => PreparedCalcuSurface;
  createTls?: typeof createDevelopmentTlsMaterial;
  /** Test-only shortening; the production shutdown budget is five seconds. */
  shutdownTimeoutMs?: number;
};

/** Starts exactly one snapshot. There is no live swap or automatic retry. */
export async function startCalcuDemo(options: DemoHostOptions = {}) {
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 5_000;
  if (
    !Number.isInteger(shutdownTimeoutMs) ||
    shutdownTimeoutMs < 1 ||
    shutdownTimeoutMs > 5_000
  )
    throw new Error('demo_start_failed');
  // Validate the entire selection before TLS material, listeners or issuance.
  const selected = (
    options.prepareSurface ?? (() => prepareInlineCalcuSurface())
  )();
  const permissions = createTaskPermissionBroker(selected);
  const identity = createEphemeralDevelopmentIdentity();
  const executor = createCalcuExecutor({
    preparedSurface: selected,
    identityVerifier: createDevelopmentIdentityVerifier(identity),
  });
  const adapter = options.adapter ?? new CodexTaskAdapter();
  const tls = await (options.createTls ?? createDevelopmentTlsMaterial)();
  let actionHost: ReturnType<typeof createActionHttpsServer>;
  try {
    actionHost = createActionHttpsServer(executor, {
      key: tls.key,
      cert: tls.cert,
    });
  } catch {
    executor.retire();
    permissions.retire();
    await tls.dispose();
    throw new Error('demo_start_failed');
  }
  const taskHost = createTaskHttpServer({
    distDirectory: options.distDirectory ?? resolve('dist'),
    permissions,
    onUnsafeCleanup() {
      executor.retire();
      void shutdown().catch(() => {});
    },
    async executeTask(task, signal, onEvent, permission) {
      if (signal.aborted) throw new Error('cancelled');
      const access = issuePermittedTaskGrant(
        executor,
        {
          subject: { user: 'calcu-demo-user' },
          delegate: {
            runtime: 'calcu-local-task-host',
            agent: identity.evidence.subject,
          },
          identity: {
            evidence: identity.evidence,
            artifactBytes: identity.artifactBytes,
          },
          audience: selected.surface.credential_audience,
          expires_at: Date.now() + 60_000,
        },
        permission,
        task,
        selected.surface,
      );
      try {
        const address = actionHost.server.address() as AddressInfo;
        const transport = createAuthenticatedHttpsTransport({
          endpoint: `https://127.0.0.1:${address.port}/agent-actions`,
          ca: tls.cert,
          timeoutMs: 5_000,
        });
        const selectedGrant = executor.selectedGrant(access.credential);
        const selectedDocument = selected.document.parse() as {
          agent_api: { receipt_delivery?: unknown };
        };
        const backend = Object.hasOwn(
          selectedDocument.agent_api,
          'receipt_delivery',
        )
          ? createInlineProposalBackend(
              access,
              selected,
              selectedGrant,
              transport,
              Date.now,
            )
          : createLocalBackend(access, transport);
        return await adapter.run(task, backend, signal, onEvent);
      } finally {
        executor.revoke(access.binding.grant_id);
      }
    },
  });
  let stopping: Promise<void> | undefined;
  let failShutdown: (error: Error) => void = () => {};
  const failure = new Promise<never>((_, reject) => {
    failShutdown = reject;
  });
  void failure.catch(() => {});
  function shutdown(): Promise<void> {
    if (stopping) return stopping;
    // Synchronous retirement comes before any await, even on retained refs.
    executor.retire();
    taskHost.retire();
    const closed = Promise.all([taskHost.close(), actionHost.close()]);
    taskHost.destroyConnections();
    actionHost.destroyConnections();
    stopping = (async () => {
      let timer: NodeJS.Timeout | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          taskHost.destroyConnections();
          actionHost.destroyConnections();
          reject(new Error('demo_shutdown_failed'));
        }, shutdownTimeoutMs);
      });
      try {
        // One shared budget, including body readers, adapter, tool transport,
        // listeners and TLS disposal. No sequential five-second allowances.
        await Promise.race([
          Promise.all([closed, taskHost.waitForIdle()]).then(() =>
            tls.dispose(),
          ),
          deadline,
        ]);
      } catch {
        void tls.dispose().catch(() => {});
        const error = new Error('demo_shutdown_failed');
        failShutdown(error);
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
    return stopping;
  }
  try {
    await actionHost.listen();
    await taskHost.listen();
  } catch {
    await shutdown();
    throw new Error('demo_start_failed');
  }
  const taskAddress = taskHost.server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${taskAddress.port}/`,
    selected,
    executor,
    taskHost,
    actionHost,
    shutdown,
    failure,
  };
}

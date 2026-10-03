// @vitest-environment node
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexTaskAdapter, type CodexTaskRunner } from './codexAdapter';
import { startCalcuDemo } from './demoHost';
import { createDevelopmentTlsMaterial } from './developmentTls';
import {
  createCalcuExecutor,
  type GrantRequest,
  type RuntimeAccess,
} from './executor';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
} from './identity';
import { createLocalBackend, localReceiptHistory } from './localBackend';
import { prepareCalcuSurface, preparedSurface } from './manifest';
import {
  claimTaskPermission,
  createTaskPermissionBroker,
} from './taskPermissions';
import { createAuthenticatedHttpsTransport } from './transport';

const input = { operator: 'multiply', left: 240, right: 0.15 } as const;
const result = { ...input, result: 36 };
const START = Date.parse('2026-10-02T00:00:00Z');
const disposals: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  await Promise.all(disposals.splice(0).map((dispose) => dispose()));
});

function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(selected = preparedSurface) {
  const identity = createTestIdentityFixture(START);
  const executor = createCalcuExecutor({
    now: () => START,
    preparedSurface: selected,
    identityVerifier: createTestIdentityVerifier(identity),
  });
  const request: GrantRequest = {
    subject: { user: 'calcu-user' },
    delegate: { runtime: 'calcu-runtime', agent: identity.evidence.subject },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: selected.surface.credential_audience,
    expires_at: START + 60_000,
  };
  return { executor, request, access: executor.issue(request) };
}

async function capture(access: RuntimeAccess) {
  let source = '';
  await expect(
    createLocalBackend(
      access,
      async (_, body) => {
        source = body;
        throw new Error('captured');
      },
      () => START,
    ).calculationPropose(input),
  ).rejects.toThrow('captured');
  return source;
}

function browserRequest(
  host: Awaited<ReturnType<typeof startCalcuDemo>>,
  path: string,
  value: unknown,
  cookie = host.taskHost.sessionToken,
) {
  const body = JSON.stringify(value);
  return new Promise<{ status?: number; body: string }>((resolve, reject) => {
    const request = httpRequest(
      new URL(path, host.url),
      {
        method: 'POST',
        headers: {
          origin: new URL(host.url).origin,
          cookie: `calcu_agent_session=${cookie}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let output = '';
        response.on('data', (chunk) => {
          output += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode, body: output }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

async function review(host: Awaited<ReturnType<typeof startCalcuDemo>>) {
  const task = 'What is 15% of 240?';
  const response = await browserRequest(host, '/api/tasks/permissions', {
    task,
  });
  expect(response.status).toBe(200);
  const offer = JSON.parse(response.body);
  return {
    task,
    permission: {
      offer_id: offer.offer_id,
      actions: [offer.action_id],
      data_classes: offer.data_classes.map((entry: { id: string }) => entry.id),
    },
  };
}

async function startHost(options: Parameters<typeof startCalcuDemo>[0] = {}) {
  const host = await startCalcuDemo(options);
  disposals.push(() => host.shutdown().catch(() => {}));
  return host;
}

describe('P5-T8B SDK live activation and retirement', () => {
  it('uses one selected snapshot for permissions → fake Codex → HTTPS → receipts', async () => {
    const selected = prepareCalcuSurface(
      'calcu.example',
      'https://calcu.example.test',
    );
    const prepare = vi.fn(() => selected);
    const adapter = new CodexTaskAdapter({
      command: process.execPath,
      appServerArgs: [
        fileURLToPath(
          new URL('./fixtures/fakeCodexAppServer.mjs', import.meta.url),
        ),
        'success',
      ],
      verifyVersion: async () => 'codex-cli 0.145.0',
      killGraceMs: 20,
    });
    let receipts: ReturnType<typeof localReceiptHistory> = [];
    const host = await startHost({
      prepareSurface: prepare,
      adapter: {
        async run(task, backend, signal, onEvent) {
          const output = await adapter.run(task, backend, signal, onEvent);
          receipts = localReceiptHistory(backend);
          return output;
        },
      },
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(host.selected).toBe(selected);
    expect(host.executor.surface).toBe(selected.surface);
    const response = await browserRequest(
      host,
      '/api/tasks/run',
      await review(host),
    );
    expect(response.status).toBe(200);
    const events = response.body
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(events.at(-1).type).toBe('task.completed');
    expect(events.at(-1).application_result).toEqual(result);
    expect(host.executor.engineCalls).toBe(1);
    expect(receipts.map((receipt) => receipt.receipt_type)).toEqual([
      'runtime',
      'app',
    ]);
    for (const receipt of receipts) {
      expect(receipt.surface_version).toBe(selected.surface.surface_version);
      expect(receipt.surface_hash).toBe(selected.surface.surface_hash);
      expect(receipt.app_id).toBe('calcu.example');
    }
    expect(response.body).not.toMatch(
      /grant_|credential|passport|identity_evidence|surface_hash/i,
    );
    await host.shutdown();
    expect(host.taskHost.server.listening).toBe(false);
    expect(host.actionHost.server.listening).toBe(false);
  });

  it('fails preparation before TLS or listeners and rejects a divergent host tuple', async () => {
    const createTls = vi.fn(createDevelopmentTlsMaterial);
    await expect(
      startCalcuDemo({
        prepareSurface: () => {
          throw new Error('schema_invalid');
        },
        createTls,
      }),
    ).rejects.toThrow('schema_invalid');
    expect(createTls).not.toHaveBeenCalled();
    const identity = createTestIdentityFixture(START);
    const identityVerifier = createTestIdentityVerifier(identity);
    expect(() =>
      createCalcuExecutor({
        preparedSurface,
        app_id: 'other',
        identityVerifier,
      }),
    ).toThrow('binding_mismatch');
    expect(() =>
      createCalcuExecutor({
        preparedSurface: {
          ...preparedSurface,
          surface: { ...preparedSurface.surface, surface_version: '0.1.1' },
        },
        identityVerifier,
      }),
    ).toThrow('binding_mismatch');
  });

  it('disposes owned TLS on a post-preparation startup failure', async () => {
    const dispose = vi.fn(async () => {});
    await expect(
      startCalcuDemo({
        createTls: async () => ({
          key: Buffer.from('invalid'),
          cert: Buffer.from('invalid'),
          dispose,
        }),
      }),
    ).rejects.toThrow('demo_start_failed');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('fails the host closed when task cleanup is reported unconfirmed', async () => {
    const host = await startHost({
      adapter: {
        async run() {
          throw new Error('agent_cleanup_failed');
        },
      },
    });
    const failed = expect(host.failure).rejects.toThrow('demo_shutdown_failed');
    await browserRequest(host, '/api/tasks/run', await review(host)).catch(
      () => undefined,
    );
    await failed;
    await expect(host.shutdown()).rejects.toThrow('demo_shutdown_failed');
    expect(host.executor.engineCalls).toBe(0);
    expect(host.taskHost.server.listening).toBe(false);
    expect(host.actionHost.server.listening).toBe(false);
  });

  it('retires every Grant, session and retained issuer/executor reference', async () => {
    const { executor, request, access } = fixture();
    const accesses = [access, executor.issue(request), executor.issue(request)];
    const bodies = await Promise.all(accesses.map(capture));
    const issue = executor.issue;
    const invoke = executor.invoke;
    executor.retire();
    executor.retire();
    expect(() => issue(request)).toThrow('unauthorized');
    for (const [index, item] of accesses.entries()) {
      await expect(invoke(item.credential, bodies[index])).rejects.toThrow(
        'unauthorized',
      );
      executor.rotateSession(item.binding.session_id);
      await expect(invoke(item.credential, bodies[index])).rejects.toThrow(
        'unauthorized',
      );
    }
    expect(executor.engineCalls).toBe(0);
  });

  it('rejects old credentials and stale tuples after restart; quota stays executor-owned', async () => {
    const old = fixture();
    const source = await capture(old.access);
    old.executor.retire();
    const fresh = fixture();
    await expect(
      fresh.executor.invoke(old.access.credential, source),
    ).rejects.toThrow('unauthorized');
    for (const stale of [
      { ...fresh.access.binding, surface_version: '0.1.1' },
      {
        ...fresh.access.binding,
        surface_hash: 'sha-256:JbCWzyXu_BiZqOhg_tomfvSI2MZOIyD_yVKR-DlDbaY',
      },
    ]) {
      await expect(
        createLocalBackend(
          { credential: fresh.access.credential, binding: stale },
          fresh.executor.invoke,
          () => START,
        ).calculationPropose(input),
      ).rejects.toThrow('binding_mismatch');
    }
    expect(fresh.executor.engineCalls).toBe(0);
    for (let count = 0; count < 3; count++)
      await expect(
        createLocalBackend(
          fresh.access,
          fresh.executor.invoke,
          () => START,
        ).calculationPropose(input),
      ).resolves.toEqual(result);
    await expect(
      createLocalBackend(
        fresh.access,
        fresh.executor.invoke,
        () => START,
      ).calculationPropose(input),
    ).rejects.toThrow('quota_exceeded');
    expect(fresh.executor.engineCalls).toBe(3);
  });

  it('retires outstanding offers and previously accepted, unclaimed permissions', () => {
    const broker = createTaskPermissionBroker(preparedSurface, () => START);
    const offer = broker.offer('task');
    const selection = {
      offer_id: offer.offer_id,
      actions: [offer.action_id],
      data_classes: offer.data_classes.map((entry) => entry.id),
    };
    const permission = broker.accept('task', selection);
    const outstanding = broker.offer('next');
    broker.retire();
    expect(() => broker.offer('task')).toThrow('permission_invalid');
    expect(() =>
      broker.accept('next', { ...selection, offer_id: outstanding.offer_id }),
    ).toThrow('permission_invalid');
    expect(() =>
      claimTaskPermission(permission, 'task', preparedSurface.surface, START),
    ).toThrow('permission_invalid');
    const fresh = createTaskPermissionBroker(preparedSurface, () => START);
    expect(() => fresh.accept('task', selection)).toThrow('permission_invalid');
    expect(fresh.offer('task').offer_id).not.toBe(offer.offer_id);
  });

  it('checks retirement again after a re-entrant identity verifier', async () => {
    const identity = createTestIdentityFixture(START);
    const verifier = createTestIdentityVerifier(identity);
    let onVerify = () => {};
    const executor = createCalcuExecutor({
      now: () => START,
      identityVerifier: {
        verify(value, now) {
          const verified = verifier.verify(value, now);
          onVerify();
          return verified;
        },
      },
    });
    const request = fixture().request;
    request.identity = {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    };
    request.delegate.agent = identity.evidence.subject;
    const access = executor.issue(request);
    const body = await capture(access);
    onVerify = () => executor.retire();
    await expect(executor.invoke(access.credential, body)).rejects.toThrow(
      'unauthorized',
    );
    expect(executor.engineCalls).toBe(0);
    const other = createCalcuExecutor({
      now: () => START,
      identityVerifier: {
        verify(value, now) {
          const verified = verifier.verify(value, now);
          other.retire();
          return verified;
        },
      },
    });
    expect(() => other.issue(request)).toThrow('unauthorized');
  });

  it('does not convert a cancelled, already executed response into success or retry', async () => {
    const { executor, access } = fixture();
    const executed = deferred();
    const release = deferred();
    const controller = new AbortController();
    const backend = createLocalBackend(
      access,
      async (credential, body, signal) => {
        const response = await executor.invoke(credential, body, signal);
        executed.resolve();
        await release.promise;
        return response;
      },
      () => START,
    );
    const operation = backend.calculationPropose(input, controller.signal);
    const rejected = expect(operation).rejects.toThrow('aborted');
    await executed.promise;
    expect(executor.engineCalls).toBe(1); // Admission/execution already happened.
    executor.retire();
    controller.abort();
    release.resolve();
    await rejected;
    expect(executor.engineCalls).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime']);
  });

  it('allows a valid delayed HTTPS request, then rejects retirement at the admission barrier', async () => {
    const { executor, access } = fixture();
    const body = await capture(access);
    const tls = await createDevelopmentTlsMaterial();
    const reached = deferred();
    const release = deferred();
    let hold = false;
    const server = createActionHttpsServer(
      {
        ...executor,
        async invoke(credential, source, signal) {
          if (hold) {
            reached.resolve();
            await release.promise;
          }
          return executor.invoke(credential, source, signal);
        },
      },
      { key: tls.key, cert: tls.cert, invokeDelayMs: 20 },
    );
    await server.listen();
    disposals.push(async () => {
      server.destroyConnections();
      await server.close();
      await tls.dispose();
    });
    const port = (server.server.address() as AddressInfo).port;
    const transport = createAuthenticatedHttpsTransport({
      endpoint: `https://127.0.0.1:${port}/agent-actions`,
      ca: tls.cert,
    });
    expect(JSON.parse(await transport(access.credential, body)).type).toBe(
      'action.result',
    );
    expect(executor.engineCalls).toBe(1);
    hold = true;
    const pending = transport(access.credential, body);
    const rejected = expect(pending).rejects.toThrow('unauthorized');
    await reached.promise;
    executor.retire();
    release.resolve();
    await rejected;
    expect(executor.engineCalls).toBe(1); // Zero additional executions.
  });

  it('blocks a valid HTTPS request cancelled before admission', async () => {
    const { executor, access } = fixture();
    const body = await capture(access);
    const tls = await createDevelopmentTlsMaterial();
    const reached = deferred();
    const release = deferred();
    const aborted = deferred();
    const server = createActionHttpsServer(
      {
        ...executor,
        async invoke(credential, source, signal) {
          signal?.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          });
          reached.resolve();
          await release.promise;
          return executor.invoke(credential, source, signal);
        },
      },
      { key: tls.key, cert: tls.cert },
    );
    await server.listen();
    disposals.push(async () => {
      server.destroyConnections();
      await server.close();
      await tls.dispose();
    });
    const port = (server.server.address() as AddressInfo).port;
    const transport = createAuthenticatedHttpsTransport({
      endpoint: `https://127.0.0.1:${port}/agent-actions`,
      ca: tls.cert,
    });
    const controller = new AbortController();
    const pending = transport(access.credential, body, controller.signal);
    const rejected = expect(pending).rejects.toThrow('aborted');
    await reached.promise;
    controller.abort();
    await rejected;
    // Wait for the real server-side close event, not a guessed sleep.
    const closing = server.close();
    await aborted.promise;
    release.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await closing;
    expect(executor.engineCalls).toBe(0);
  });

  it('closes partial HTTP and HTTPS bodies without issuing or executing', async () => {
    const runner: CodexTaskRunner = {
      run: vi.fn(async () => {
        throw new Error('unexpected');
      }),
    };
    const host = await startHost({ adapter: runner });
    const httpsAddress = host.actionHost.server.address() as AddressInfo;
    const httpSocketClosed = deferred();
    const httpsSocketClosed = deferred();
    const requestAccepted = deferred();
    host.taskHost.server.once('request', () => requestAccepted.resolve());
    const req = httpRequest(new URL('/api/tasks/permissions', host.url), {
      method: 'POST',
      headers: {
        origin: new URL(host.url).origin,
        cookie: `calcu_agent_session=${host.taskHost.sessionToken}`,
        'content-type': 'application/json',
        'content-length': 100,
      },
    });
    req.on('error', () => {});
    req.once('close', () => httpSocketClosed.resolve());
    req.write('{"task":');
    await requestAccepted.promise;
    // TLS material remains private; a separate pinned test host covers HTTPS.
    expect(httpsAddress.port).toBeGreaterThan(0);
    const tls = await createDevelopmentTlsMaterial();
    const { executor, access } = fixture();
    const action = createActionHttpsServer(executor, {
      key: tls.key,
      cert: tls.cert,
    });
    await action.listen();
    const port = (action.server.address() as AddressInfo).port;
    const actionAccepted = deferred();
    action.server.once('request', () => actionAccepted.resolve());
    const https = httpsRequest({
      hostname: '127.0.0.1',
      port,
      method: 'POST',
      path: '/agent-actions',
      ca: tls.cert,
      headers: {
        'content-type': 'application/json',
        'content-length': 100,
        authorization: `Bearer ${access.credential}`,
      },
    });
    https.on('error', () => {});
    https.once('close', () => httpsSocketClosed.resolve());
    https.write('{"type":');
    await actionAccepted.promise;
    executor.retire();
    const closing = action.close();
    action.destroyConnections();
    await Promise.all([
      host.shutdown(),
      closing,
      httpSocketClosed.promise,
      httpsSocketClosed.promise,
    ]);
    await tls.dispose();
    expect(runner.run).not.toHaveBeenCalled();
    expect(host.executor.engineCalls).toBe(0);
    expect(executor.engineCalls).toBe(0);
  });

  it('waits for task finalization and reports a shared deadline failure, not readiness', async () => {
    const started = deferred();
    const release = deferred();
    const host = await startHost({
      shutdownTimeoutMs: 80,
      adapter: {
        async run() {
          started.resolve();
          await release.promise;
          throw new Error('cancelled');
        },
      },
    });
    const pending = browserRequest(
      host,
      '/api/tasks/run',
      await review(host),
    ).catch(() => undefined);
    await started.promise;
    const before = Date.now();
    const stopping = host.shutdown();
    expect(host.shutdown()).toBe(stopping);
    await expect(stopping).rejects.toThrow('demo_shutdown_failed');
    await expect(host.failure).rejects.toThrow('demo_shutdown_failed');
    expect(Date.now() - before).toBeLessThan(1_000);
    expect(host.taskHost.server.listening).toBe(false);
    expect(host.actionHost.server.listening).toBe(false);
    release.resolve();
    await host.taskHost.waitForIdle();
    await pending;
    expect(host.executor.engineCalls).toBe(0);
  });

  it('requires a new cookie and fresh permission review after a clean restart', async () => {
    const old = await startHost();
    const selected = await review(old);
    const oldCookie = old.taskHost.sessionToken;
    await old.shutdown();
    const fresh = await startHost();
    expect(fresh.taskHost.sessionToken).not.toBe(oldCookie);
    expect(
      (await browserRequest(fresh, '/api/tasks/run', selected, oldCookie))
        .status,
    ).toBe(403);
    expect(
      (await browserRequest(fresh, '/api/tasks/run', selected)).status,
    ).toBe(400);
    expect((await review(fresh)).permission.offer_id).not.toBe(
      selected.permission.offer_id,
    );
    expect(fresh.executor.engineCalls).toBe(0);
  });
});

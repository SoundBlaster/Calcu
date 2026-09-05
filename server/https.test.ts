// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createCalcuExecutor, surface } from './executor';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
} from './identity';
import { createLocalBackend } from './localBackend';
import {
  createAuthenticatedHttpsTransport,
  MAX_BODY_BYTES,
  MAX_RESPONSE_BYTES,
} from './transport';

const execFileAsync = promisify(execFile);
const START = Date.parse('2026-09-05T00:00:00Z');
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;

type TlsMaterial = { directory: string; key: Buffer; cert: Buffer };
type Fixture = {
  executor: ReturnType<typeof createCalcuExecutor>;
  access: ReturnType<ReturnType<typeof createCalcuExecutor>['issue']>;
  identity: ReturnType<typeof createTestIdentityFixture>;
  server: ReturnType<typeof createActionHttpsServer>;
  tls: TlsMaterial;
  port: number;
};

const openServers: Array<ReturnType<typeof createActionHttpsServer>['server']> =
  [];
const openDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    openDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTlsMaterial(): Promise<TlsMaterial> {
  const directory = await mkdtemp(join(tmpdir(), 'calcu-p5-t2-tls-'));
  openDirectories.push(directory);
  const keyPath = join(directory, 'key.pem');
  const certPath = join(directory, 'cert.pem');
  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1,DNS:localhost',
  ]);
  return {
    directory,
    key: await readFile(keyPath),
    cert: await readFile(certPath),
  };
}

async function openFixture(options: { delayMs?: number } = {}) {
  let now = START;
  const identity = createTestIdentityFixture(START);
  const executor = createCalcuExecutor({
    now: () => now,
    identityVerifier: createTestIdentityVerifier(identity),
  });
  const access = executor.issue({
    subject: { user: 'calcu-user-local' },
    delegate: {
      runtime: 'calcu-runtime-local',
      agent: identity.evidence.subject,
    },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: surface.credential_audience,
    expires_at: START + 60_000,
  });
  const tls = await createTlsMaterial();
  const server = createActionHttpsServer(executor, {
    key: tls.key,
    cert: tls.cert,
    invokeDelayMs: options.delayMs,
  });
  await server.listen();
  openServers.push(server.server);
  const address = server.server.address();
  if (!address || typeof address === 'string')
    throw new Error('test_setup_failed');
  const port = (address as AddressInfo).port;
  return {
    executor,
    access,
    identity,
    server,
    tls,
    port,
    setNow(value: number) {
      now = value;
    },
  } satisfies Fixture & { setNow(value: number): void };
}

function rawRequest(
  fixture: Fixture,
  options: {
    method?: string;
    path?: string;
    host?: string;
    contentType?: string;
    body?: string;
    credential?: string;
  } = {},
) {
  return new Promise<{
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const body = options.body ?? '{}';
    const request = httpsRequest(
      {
        hostname: '127.0.0.1',
        port: fixture.port,
        path: options.path ?? '/agent-actions',
        method: options.method ?? 'POST',
        ca: fixture.tls.cert,
        rejectUnauthorized: true,
        headers: {
          host: options.host ?? `127.0.0.1:${fixture.port}`,
          authorization: `Bearer ${options.credential ?? fixture.access.credential}`,
          'content-type': options.contentType ?? 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        response.on('end', () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

function transportFor(fixture: Fixture, timeoutMs?: number) {
  return createAuthenticatedHttpsTransport({
    endpoint: `https://127.0.0.1:${fixture.port}/agent-actions`,
    ca: fixture.tls.cert,
    timeoutMs,
  });
}

describe('ASP compatibility bearer over loopback HTTPS', () => {
  it('completes the real LocalBackend → HTTPS → executor → Calcu round trip', async () => {
    const fixture = await openFixture();
    const backend = createLocalBackend(fixture.access, transportFor(fixture));
    await expect(backend.calculationPropose(input)).resolves.toEqual({
      ...input,
      result: 36,
    });
    expect(fixture.executor.engineCalls).toBe(1);
  });

  it('uses closed, non-cacheable error envelopes and rejects body credentials', async () => {
    const fixture = await openFixture();
    const response = await rawRequest(fixture, {
      body: JSON.stringify({ credential: fixture.access.credential }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(JSON.parse(response.body)).toEqual({
      type: 'action.error',
      error: { code: 'schema_invalid' },
    });
    expect(response.body).not.toContain(fixture.access.credential);
    expect(fixture.executor.engineCalls).toBe(0);
  });

  it.each([
    ['GET', '/agent-actions', `127.0.0.1:PORT`, 'application/json'],
    ['POST', '/other', `127.0.0.1:PORT`, 'application/json'],
    ['POST', '/agent-actions', 'localhost:PORT', 'application/json'],
    ['POST', '/agent-actions', `127.0.0.1:PORT`, 'text/plain'],
  ])('rejects method/path/host/content-type mismatch (%s %s)', async (method, path, host, contentType) => {
    const fixture = await openFixture();
    const response = await rawRequest(fixture, {
      method,
      path,
      host: host.replace('PORT', String(fixture.port)),
      contentType,
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(response.body).type).toBe('action.error');
    expect(fixture.executor.engineCalls).toBe(0);
  });

  it('requires the exact HTTPS loopback endpoint and pinned TLS', async () => {
    const fixture = await openFixture();
    expect(() =>
      createAuthenticatedHttpsTransport({
        endpoint: `http://127.0.0.1:${fixture.port}/agent-actions`,
        ca: fixture.tls.cert,
      }),
    ).toThrow('transport_endpoint_invalid');
    expect(() =>
      createAuthenticatedHttpsTransport({
        endpoint: `https://localhost:${fixture.port}/agent-actions`,
        ca: fixture.tls.cert,
      }),
    ).toThrow('transport_endpoint_invalid');
    expect(() =>
      createAuthenticatedHttpsTransport({
        endpoint: `https://user@127.0.0.1:${fixture.port}/agent-actions`,
        ca: fixture.tls.cert,
      }),
    ).toThrow('transport_endpoint_invalid');
    await expect(
      createAuthenticatedHttpsTransport({
        endpoint: `https://127.0.0.1:${fixture.port}/agent-actions`,
        ca: Buffer.from('not a certificate'),
      })(fixture.access.credential, '{}'),
    ).rejects.toThrow('transport_error');
    expect(fixture.executor.engineCalls).toBe(0);
  });

  it('rejects redirect responses without following them', async () => {
    const fixture = await openFixture();
    const redirectServer = createHttpsServer(
      { key: fixture.tls.key, cert: fixture.tls.cert },
      (_request, response) => {
        response.statusCode = 302;
        response.setHeader('location', 'https://127.0.0.1/agent-actions');
        response.end('redirect');
      },
    );
    await new Promise<void>((resolve) =>
      redirectServer.listen(0, '127.0.0.1', () => resolve()),
    );
    try {
      const address = redirectServer.address() as AddressInfo;
      await expect(
        createAuthenticatedHttpsTransport({
          endpoint: `https://127.0.0.1:${address.port}/agent-actions`,
          ca: fixture.tls.cert,
        })(fixture.access.credential, '{}'),
      ).rejects.toThrow('transport_error');
      expect(fixture.executor.engineCalls).toBe(0);
    } finally {
      await new Promise<void>((resolve) =>
        redirectServer.close(() => resolve()),
      );
    }
  });

  it('bounds request/response sizes before admission', async () => {
    const fixture = await openFixture();
    const oversized = 'x'.repeat(MAX_BODY_BYTES + 1);
    await expect(
      transportFor(fixture)(fixture.access.credential, oversized),
    ).rejects.toThrow('schema_invalid');
    const serverResponse = await rawRequest(fixture, { body: oversized });
    expect(serverResponse.statusCode).toBe(400);
    expect(JSON.parse(serverResponse.body).error.code).toBe('schema_invalid');
    const responseServer = createHttpsServer(
      { key: fixture.tls.key, cert: fixture.tls.cert },
      (_request, response) => {
        response.statusCode = 200;
        response.setHeader('content-type', 'application/json');
        response.end('x'.repeat(MAX_RESPONSE_BYTES + 1));
      },
    );
    await new Promise<void>((resolve) =>
      responseServer.listen(0, '127.0.0.1', () => resolve()),
    );
    try {
      const address = responseServer.address() as AddressInfo;
      await expect(
        createAuthenticatedHttpsTransport({
          endpoint: `https://127.0.0.1:${address.port}/agent-actions`,
          ca: fixture.tls.cert,
        })(fixture.access.credential, '{}'),
      ).rejects.toThrow('response_too_large');
    } finally {
      await new Promise<void>((resolve) =>
        responseServer.close(() => resolve()),
      );
    }
    expect(fixture.executor.engineCalls).toBe(0);
  });

  it('supports timeout and AbortSignal without invoking the engine', async () => {
    const fixture = await openFixture({ delayMs: 50 });
    await expect(
      createAuthenticatedHttpsTransport({
        endpoint: `https://127.0.0.1:${fixture.port}/agent-actions`,
        ca: fixture.tls.cert,
        timeoutMs: 5,
      })(fixture.access.credential, '{}'),
    ).rejects.toThrow('transport_timeout');
    const controller = new AbortController();
    const pending = transportFor(fixture, 2_000)(
      fixture.access.credential,
      '{}',
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(fixture.executor.engineCalls).toBe(0);
  });

  it('enforces grant expiry, revocation and quota through HTTPS', async () => {
    const fixture = await openFixture();
    const backend = createLocalBackend(fixture.access, transportFor(fixture));
    await backend.calculationPropose(input);
    await backend.calculationPropose(input);
    await backend.calculationPropose(input);
    await expect(backend.calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(fixture.executor.engineCalls).toBe(3);
    fixture.executor.revoke(fixture.access.credential);
    await expect(backend.calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
  });
});

// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodexTaskResult } from './codexAdapter';
import { prepareCalcuSurface } from './manifest';
import { createTaskHttpServer, type TaskExecution } from './taskHost';
import { createTaskPermissionBroker } from './taskPermissions';

const openServers: ReturnType<typeof createTaskHttpServer>[] = [];
const directories: string[] = [];
const calculation = {
  operator: 'multiply',
  left: 240,
  right: 0.15,
  result: 36,
} as const;
const trace = {
  model: 'gpt-5.6-luna',
  effort: 'low',
  tool_name: 'calculation_propose',
  call_id: 'call-safe',
  operands: { operator: 'multiply', left: 240, right: 0.15 },
} as const;
const completed: CodexTaskResult = {
  application_result: calculation,
  agent_message: 'Verified.',
  trace,
};

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (host) =>
        new Promise<void>((resolve) => {
          host.cancelActiveTask();
          if (!host.server.listening) resolve();
          else host.server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(
  executeTask: TaskExecution = vi.fn(async () => completed),
) {
  const directory = await mkdtemp(join(tmpdir(), 'calcu-task-host-'));
  directories.push(directory);
  await writeFile(
    join(directory, 'index.html'),
    '<!doctype html><title>Calcu</title>',
  );
  const host = createTaskHttpServer({
    distDirectory: directory,
    executeTask,
    sessionToken: 'session-token',
    permissions: createTaskPermissionBroker(prepareCalcuSurface()),
  });
  await host.listen();
  openServers.push(host);
  const address = host.server.address() as AddressInfo;
  return {
    host,
    executeTask,
    port: address.port,
    origin: `http://127.0.0.1:${address.port}`,
    hostHeader: `127.0.0.1:${address.port}`,
  };
}

function send(
  port: number,
  options: {
    method?: string;
    path?: string;
    host?: string;
    origin?: string;
    cookie?: string;
    contentType?: string;
    body?: string;
  } = {},
) {
  return new Promise<{
    status: number | undefined;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const body = options.body ?? '';
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path ?? '/',
        headers: {
          host: options.host ?? `127.0.0.1:${port}`,
          ...(options.origin ? { origin: options.origin } : {}),
          ...(options.cookie ? { cookie: options.cookie } : {}),
          ...(options.contentType
            ? { 'content-type': options.contentType }
            : {}),
          ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

async function permissionBody(
  current: Awaited<ReturnType<typeof fixture>>,
  body: string,
) {
  const preview = await send(current.port, {
    method: 'POST',
    path: '/api/tasks/permissions',
    origin: current.origin,
    cookie: 'calcu_agent_session=session-token',
    contentType: 'application/json',
    body,
  });
  if (preview.status !== 200) return { error: preview };
  const offer = JSON.parse(preview.body);
  return {
    body: JSON.stringify({
      ...JSON.parse(body),
      permission: {
        offer_id: offer.offer_id,
        actions: [offer.action_id],
        data_classes: offer.data_classes.map((item: { id: string }) => item.id),
      },
    }),
  };
}

async function runRequest(
  fixtureValue: Awaited<ReturnType<typeof fixture>>,
  body: string,
) {
  const prepared = await permissionBody(fixtureValue, body);
  if (prepared.error) return prepared.error;
  return send(fixtureValue.port, {
    method: 'POST',
    path: '/api/tasks/run',
    origin: fixtureValue.origin,
    cookie: 'calcu_agent_session=session-token',
    contentType: 'application/json',
    body: prepared.body,
  });
}

describe('local task HTTP host', () => {
  it.each([
    '\n',
    '"',
    '\\',
    '\u0001',
  ])('accepts a maximum-size decoded task with escaped %j through preview and run', async (character) => {
    const current = await fixture();
    const task = `x${character.repeat(4094)}x`;
    expect(Buffer.byteLength(task)).toBe(4096);
    const response = await runRequest(current, JSON.stringify({ task }));
    expect(response.status).toBe(200);
    expect(current.executeTask).toHaveBeenCalledTimes(1);
    expect(vi.mocked(current.executeTask).mock.calls[0]?.[0]).toBe(task);
  });
  it('never executes a task without the exact one-use permission selection', async () => {
    const current = await fixture();
    const raw = (body: unknown) =>
      send(current.port, {
        method: 'POST',
        path: '/api/tasks/run',
        origin: current.origin,
        cookie: 'calcu_agent_session=session-token',
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    expect((await raw({ task: 'calculate' })).status).toBe(400);
    const preview = await send(current.port, {
      method: 'POST',
      path: '/api/tasks/permissions',
      origin: current.origin,
      cookie: 'calcu_agent_session=session-token',
      contentType: 'application/json',
      body: JSON.stringify({ task: 'calculate' }),
    });
    const offer = JSON.parse(preview.body);
    expect(preview.headers['cache-control']).toBe('no-store');
    expect(preview.body).not.toMatch(
      /credential|grant_hash|identity_evidence|Passport/,
    );
    const selection = {
      offer_id: offer.offer_id,
      actions: [offer.action_id],
      data_classes: offer.data_classes.map((item: { id: string }) => item.id),
    };
    expect(
      (
        await raw({
          task: 'calculate',
          permission: { ...selection, data_classes: ['calculation.status'] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await raw({
          task: 'calculate',
          permission: { ...selection, actions: ['calculation.delete'] },
        })
      ).status,
    ).toBe(400);
    expect((await raw({ task: 'changed', permission: selection })).status).toBe(
      400,
    );
    expect(current.executeTask).not.toHaveBeenCalled();
    expect(
      (await raw({ task: 'calculate', permission: selection })).status,
    ).toBe(200);
    expect(
      (await raw({ task: 'calculate', permission: selection })).status,
    ).toBe(400);
    expect(current.executeTask).toHaveBeenCalledTimes(1);
  });

  it.each([
    'origin',
    'cookie',
    'host',
  ])('protects permission offers against wrong %s', async (kind) => {
    const current = await fixture();
    const denied = await send(current.port, {
      method: 'POST',
      path: '/api/tasks/permissions',
      origin: kind === 'origin' ? 'http://attacker.example' : current.origin,
      host: kind === 'host' ? 'attacker.example' : current.hostHeader,
      cookie:
        kind === 'cookie'
          ? 'calcu_agent_session=wrong'
          : 'calcu_agent_session=session-token',
      contentType: 'application/json',
      body: JSON.stringify({ task: 'calculate' }),
    });
    expect(denied.status).toBe(403);
    expect(current.executeTask).not.toHaveBeenCalled();
  });
  it('sets a strict process cookie and streams only the safe task projection', async () => {
    const current = await fixture(async (_task, _signal, onEvent) => {
      onEvent({ type: 'progress', phase: 'starting' });
      onEvent({ type: 'tool_result', result: calculation, trace });
      return { ...completed, grant: 'secret-grant' };
    });
    const page = await send(current.port);
    expect(page.status).toBe(200);
    expect(page.headers['set-cookie']?.[0]).toContain(
      'HttpOnly; SameSite=Strict; Path=/',
    );
    expect(page.headers['content-security-policy']).toContain(
      "connect-src 'self'",
    );

    const response = await runRequest(
      current,
      JSON.stringify({ task: 'Сколько будет 15% от 240?' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    const events = response.body
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(events.map((event) => event.type)).toEqual([
      'task.accepted',
      'task.progress',
      'task.tool_result',
      'task.completed',
    ]);
    expect(new Set(events.map((event) => event.task_id)).size).toBe(1);
    expect(response.body).not.toContain('grant');
    expect(response.body).not.toContain('credential');
    expect(response.body).not.toContain('passport');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['wrong host', { host: 'localhost:1' }],
    ['wrong origin', { origin: 'http://evil.example' }],
    ['missing cookie', { cookie: '' }],
    ['wrong content type', { contentType: 'text/plain' }],
  ])('rejects %s before invoking the adapter', async (_name, override) => {
    const current = await fixture();
    const body = JSON.stringify({ task: 'calculate' });
    const response = await send(current.port, {
      method: 'POST',
      path: '/api/tasks/run',
      host: current.hostHeader,
      origin: current.origin,
      cookie: 'calcu_agent_session=session-token',
      contentType: 'application/json',
      body,
      ...override,
    });
    expect(response.status).toBe(403);
    expect(current.executeTask).not.toHaveBeenCalled();
  });

  it('rejects oversized and non-closed task payloads', async () => {
    const current = await fixture();
    const oversized = await runRequest(
      current,
      JSON.stringify({ task: 'x'.repeat(4_097) }),
    );
    expect(oversized.status).toBe(400);
    const extra = await runRequest(
      current,
      JSON.stringify({ task: 'calculate', grant: 'do-not-accept' }),
    );
    expect(extra.status).toBe(400);
    expect(current.executeTask).not.toHaveBeenCalled();
  });

  it('permits only one active task', async () => {
    let release: (() => void) | undefined;
    const execute = vi.fn(
      () =>
        new Promise<CodexTaskResult>((resolve) => {
          release = () => resolve(completed);
        }),
    );
    const current = await fixture(execute);
    const first = runRequest(current, JSON.stringify({ task: 'first' }));
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const second = await runRequest(
      current,
      JSON.stringify({ task: 'second' }),
    );
    expect(second.status).toBe(409);
    expect(JSON.parse(second.body)).toEqual({ error: { code: 'task_busy' } });
    release?.();
    expect((await first).status).toBe(200);
  });

  it('maps internal failures to a closed browser error', async () => {
    const current = await fixture(async () => {
      throw new Error('secret-bearing-internal-error');
    });
    const response = await runRequest(
      current,
      JSON.stringify({ task: 'calculate' }),
    );
    expect(response.body).toContain('backend_unavailable');
    expect(response.body).not.toContain('secret-bearing');
  });

  it('aborts the task when the browser disconnects', async () => {
    let observedAbort = false;
    const execute: TaskExecution = (_task, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            observedAbort = true;
            reject(new Error('cancelled'));
          },
          { once: true },
        );
      });
    const current = await fixture(execute);
    const prepared = await permissionBody(
      current,
      JSON.stringify({ task: 'disconnect me' }),
    );
    if (!prepared.body) throw new Error('Missing test permission');
    const body = prepared.body;
    await new Promise<void>((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port: current.port,
          method: 'POST',
          path: '/api/tasks/run',
          headers: {
            host: current.hostHeader,
            origin: current.origin,
            cookie: 'calcu_agent_session=session-token',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
          },
        },
        (response) => {
          response.once('data', () => {
            response.destroy();
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.end(body);
    });
    await vi.waitFor(() => expect(observedAbort).toBe(true));
  });
});

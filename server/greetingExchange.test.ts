// @vitest-environment node
// A separate application/test lease, NOT another conforming ASP issuer/executor.
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:https';
import { CanonicalObjectHash, JsonDocument } from '@0al/agent-surface';
import { Value } from '@sinclair/typebox/value';
import canonicalize from 'canonicalize';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { GreetingApp } from './fixtures/greetingApp';
import {
  GreetingConsumer,
  greetingParent,
  greetingSchema,
} from './fixtures/greetingConsumer';
import { ownedServerLifecycle } from './serverLifecycle';
import { createAuthenticatedHttpsTransport } from './transport';

const document = (value: unknown) => new JsonDocument(JSON.stringify(value));
const hash = (kind: string, value: unknown) =>
  new CanonicalObjectHash(
    `https://github.com/0al-spec/agent-surface/hash/${kind}/v1`,
  ).digest(document(value));
const input = () => ({
  recipients: ['Ada', 'Grace'],
  style: { prefix: 'Welcome', punctuation: '!' },
});
let tls: Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>;
const cleanups: Array<() => Promise<void>> = [];
beforeAll(async () => {
  tls = await createDevelopmentTlsMaterial();
});
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
afterAll(async () => {
  await tls.dispose();
});

function closed(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('schema_invalid');
  const object = value as Record<string, unknown>;
  if (
    Object.keys(object).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(object, key))
  )
    throw new Error('schema_invalid');
  return object;
}

async function fixture() {
  const credential = randomUUID();
  const binding = {
    session_id: randomUUID(),
    session_generation: 1,
    grant_id: 'synthetic-greeting-test-lease',
    grant_hash: greetingParent.receipt_hash,
    app_id: 'greeting-test-app',
    surface_version: 'fixture-1',
    surface_hash: greetingParent.receipt_hash,
    subject: { user: 'greeting-test-user' },
    delegate: {
      runtime: 'greeting-test-runtime',
      agent: 'greeting-test-agent',
    },
    audience: '',
    identity_evidence_hash: greetingParent.receipt_hash,
  };
  let revoked = false;
  let generation = 1;
  let now = 0;
  let calls = 0;
  let authority = '';
  const app = new GreetingApp();
  const native = vi.spyOn(app, 'greet');
  const wire = { request: '', response: '' };
  const server = createServer(
    { key: tls.key, cert: tls.cert },
    async (req, res) => {
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      try {
        if (
          req.method !== 'POST' ||
          req.url !== '/agent-actions' ||
          req.headers.host !== authority ||
          req.headers.origin ||
          req.headers['content-type'] !== 'application/json'
        )
          throw new Error('schema_invalid');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) throw new Error('schema_invalid');
          chunks.push(chunk);
        }
        wire.request = Buffer.concat(chunks).toString('utf8');
        if (
          req.headers.authorization !== `Bearer ${credential}` ||
          revoked ||
          now >= 60_000
        )
          throw new Error('unauthorized');
        const envelope = closed(new JsonDocument(wire.request).parse(8192), [
          'type',
          'payload',
        ]);
        if (envelope.type !== 'action.request')
          throw new Error('schema_invalid');
        const payload = closed(envelope.payload, [
          ...Object.keys(binding),
          'action_id',
          'trace_id',
          'span_id',
          'idempotency_key',
          'parent_receipt_hash',
          'runtime_receipt',
          'input_hash',
          'execution',
          'execution_hash',
          'input',
        ]);
        for (const [key, expected] of Object.entries(binding))
          if (canonicalize(payload[key]) !== canonicalize(expected))
            throw new Error('binding_mismatch');
        if (payload.session_generation !== generation)
          throw new Error('binding_mismatch');
        if (payload.action_id !== 'greeting.propose')
          throw new Error('action_not_allowed');
        const execution = closed(payload.execution, ['mode', 'execution_id']);
        if (
          execution.mode !== 'propose' ||
          typeof execution.execution_id !== 'string' ||
          !execution.execution_id
        )
          throw new Error('schema_invalid');
        if (!Value.Check(greetingSchema, payload.input))
          throw new Error('schema_invalid');
        if (
          payload.input_hash !== hash('action-input', payload.input) ||
          payload.execution_hash !== hash('action-execution', execution)
        )
          throw new Error('binding_mismatch');
        if (
          payload.parent_receipt_hash !== greetingParent.receipt_hash ||
          canonicalize(payload.runtime_receipt) !== canonicalize(greetingParent)
        )
          throw new Error('greeting_evidence_invalid');
        if (calls >= 2) throw new Error('quota_exceeded');
        calls++;
        const output = app.greet(payload.input);
        const {
          input: _input,
          runtime_receipt: _parent,
          ...correlation
        } = payload;
        wire.response = JSON.stringify({
          type: 'action.result',
          payload: {
            ...correlation,
            result: 'success',
            output,
            receipt: {
              fixture_kind: 'greeting-test-result',
              parent_receipt_hash: payload.parent_receipt_hash,
              input_hash: payload.input_hash,
              output_hash: hash('action-output', output),
            },
          },
        });
        res.end(wire.response);
      } catch (error) {
        // Fixed test errors, never reflected request/credential data.
        const allowed = [
          'schema_invalid',
          'unauthorized',
          'binding_mismatch',
          'action_not_allowed',
          'greeting_evidence_invalid',
          'quota_exceeded',
        ];
        const code =
          error instanceof Error && allowed.includes(error.message)
            ? error.message
            : 'schema_invalid';
        res.statusCode = 400;
        res.end(JSON.stringify({ error: { code } }));
      }
    },
  );
  const lifecycle = ownedServerLifecycle(server);
  cleanups.push(async () => {
    lifecycle.destroyConnections();
    await lifecycle.close();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('fixture_failed');
  authority = `127.0.0.1:${address.port}`;
  binding.audience = `https://${authority}/agent-actions`;
  const transport = createAuthenticatedHttpsTransport({
    endpoint: binding.audience,
    ca: tls.cert,
  });
  return {
    credential,
    binding,
    transport,
    native,
    wire,
    consumer: (send = transport) =>
      new GreetingConsumer(credential, document(binding), send),
    revoke: () => {
      revoked = true;
    },
    rotate: () => {
      generation++;
    },
    expire: () => {
      now = 60_000;
    },
  };
}

it('keeps the native app independent and reaches it once through real TLS', async () => {
  expect(
    new GreetingApp().greet({
      recipients: ['World'],
      style: { prefix: 'Hello', punctuation: '!' },
    }),
  ).toEqual({ messages: ['Hello, World!'] });
  const state = await fixture();
  const output = await state.consumer().greet(input());
  expect(output).toEqual({ messages: ['Welcome, Ada!', 'Welcome, Grace!'] });
  expect(state.native).toHaveBeenCalledExactlyOnceWith(input());
  for (const text of [
    state.wire.request,
    state.wire.response,
    JSON.stringify(output),
  ])
    expect(text).not.toContain(state.credential);
  expect(JSON.stringify(output)).not.toContain(state.binding.grant_id);
});

it('owns nested input across the transport callback', async () => {
  const state = await fixture();
  const value = input();
  const consumer = state.consumer(async (...args) => {
    value.recipients.reverse();
    value.style.prefix = 'Hello';
    return state.transport(...args);
  });
  expect(await consumer.greet(value)).toEqual({
    messages: ['Welcome, Ada!', 'Welcome, Grace!'],
  });
  expect(state.native).toHaveBeenCalledExactlyOnceWith(input());
  expect(value.recipients).toEqual(['Grace', 'Ada']);
  expect(Object.isFrozen(value)).toBe(false);
});

it('snapshots the supplied binding before later caller edits', async () => {
  const state = await fixture();
  const supplied = structuredClone(state.binding);
  const consumer = new GreetingConsumer(
    state.credential,
    document(supplied),
    state.transport,
  );
  supplied.delegate.agent = 'changed';
  supplied.subject.user = 'changed';
  expect(await consumer.greet(input())).toEqual({
    messages: ['Welcome, Ada!', 'Welcome, Grace!'],
  });
  expect(state.native).toHaveBeenCalledOnce();
});

it.each([
  '',
  'wrong-test-credential',
])('rejects an invalid test credential without native entry or reflection', async (credential) => {
  const state = await fixture();
  const consumer = state.consumer((_credential, body, signal) =>
    state.transport(credential, body, signal),
  );
  await expect(consumer.greet(input())).rejects.toThrow(/^unauthorized$/);
  expect(state.native).not.toHaveBeenCalled();
  expect(state.wire.request).not.toContain(state.credential);
});

it.each([
  {},
  { ...input(), extra: true },
  { ...input(), recipients: [] },
  { ...input(), recipients: ['x'.repeat(65)] },
  { ...input(), style: { prefix: 'Hello', punctuation: '!', extra: true } },
  { ...input(), style: { prefix: 'Hello' } },
])('rejects bad domain input before transport: %j', async (value) => {
  const state = await fixture();
  const send = vi.fn(state.transport);
  await expect(state.consumer(send).greet(value)).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  expect(state.native).not.toHaveBeenCalled();
});

it.each([
  'revoke',
  'rotate',
  'expire',
] as const)('keeps %s in the synthetic host lease', async (event) => {
  const state = await fixture();
  const consumer = state.consumer();
  state[event]();
  await expect(consumer.greet(input())).rejects.toThrow(
    event === 'rotate' ? 'binding_mismatch' : 'unauthorized',
  );
  expect(state.native).not.toHaveBeenCalled();
});

it('keeps the test quota at the host across new consumer instances', async () => {
  const state = await fixture();
  await state.consumer().greet(input());
  await state.consumer().greet(input());
  await expect(state.consumer().greet(input())).rejects.toThrow(
    'quota_exceeded',
  );
  expect(state.native).toHaveBeenCalledTimes(2);
});

it.each([
  'action',
  'input',
  'array',
  'unicode',
  'credential',
  'mode',
  'parent',
])('rejects changed request %s before native entry', async (kind) => {
  const state = await fixture();
  const consumer = state.consumer(async (credential, raw, signal) => {
    const message = JSON.parse(raw);
    if (kind === 'action') message.payload.action_id = 'calculation.propose';
    if (kind === 'input') message.payload.input.style.punctuation = '?';
    if (kind === 'array') message.payload.input.recipients.reverse();
    if (kind === 'unicode') message.payload.input.recipients[0] = 'cafe\u0301';
    if (kind === 'credential') message.payload.credential = credential;
    if (kind === 'mode') message.payload.execution.mode = 'commit';
    if (kind === 'parent')
      message.payload.runtime_receipt.fixture_kind = 'calcu-receipt';
    return state.transport(credential, JSON.stringify(message), signal);
  });
  await expect(
    consumer.greet({ ...input(), recipients: ['caf\u00e9', 'Grace'] }),
  ).rejects.toThrow();
  expect(state.native).not.toHaveBeenCalled();
});

it('accepts reordered input, binding and execution object members without changing hashes', async () => {
  const state = await fixture();
  const consumer = state.consumer(async (credential, raw, signal) => {
    const request = JSON.parse(raw);
    request.payload.input = {
      style: { punctuation: '!', prefix: 'Welcome' },
      recipients: ['Ada', 'Grace'],
    };
    const reply = JSON.parse(
      await state.transport(credential, JSON.stringify(request), signal),
    );
    const { runtime, agent } = reply.payload.delegate;
    reply.payload.delegate = { agent, runtime };
    const { mode, execution_id } = reply.payload.execution;
    reply.payload.execution = { execution_id, mode };
    return JSON.stringify(reply);
  });
  expect(await consumer.greet(input())).toEqual({
    messages: ['Welcome, Ada!', 'Welcome, Grace!'],
  });
  expect(state.native).toHaveBeenCalledOnce();
});

it.each([
  'correlation',
  'shape',
  'extra',
  'count',
  'array',
  'evidence kind',
  'parent',
  'input hash',
  'output hash',
])('rejects response %s after one native entry', async (kind) => {
  const state = await fixture();
  const consumer = state.consumer(async (...args) => {
    const reply = JSON.parse(await state.transport(...args));
    if (kind === 'correlation') reply.payload.session_generation++;
    if (kind === 'shape') reply.payload.output.messages = 'not-an-array';
    if (kind === 'extra') reply.payload.output.credential = 'forged';
    if (kind === 'count') reply.payload.output.messages.pop();
    if (kind === 'array') reply.payload.output.messages.reverse();
    if (kind === 'evidence kind')
      reply.payload.receipt.fixture_kind = 'calcu-receipt';
    if (kind === 'parent') reply.payload.receipt.parent_receipt_hash = 'wrong';
    if (kind === 'input hash') reply.payload.receipt.input_hash = 'wrong';
    if (kind === 'output hash') reply.payload.receipt.output_hash = 'wrong';
    return JSON.stringify(reply);
  });
  await expect(consumer.greet(input())).rejects.toThrow();
  expect(state.native).toHaveBeenCalledOnce();
});

it('rejects an old result even when domain inputs are identical', async () => {
  const state = await fixture();
  let first = '';
  const consumer = state.consumer(async (...args) => {
    const reply = await state.transport(...args);
    first ||= reply;
    return first;
  });
  await consumer.greet(input());
  await expect(consumer.greet(input())).rejects.toThrow('invalid_response');
  expect(state.native).toHaveBeenCalledTimes(2);
});

it.each([
  'before',
  'after',
])('keeps cancellation %s execution distinct', async (when) => {
  const state = await fixture();
  const controller = new AbortController();
  if (when === 'before') controller.abort();
  const consumer = state.consumer(async (...args) => {
    const reply = await state.transport(...args);
    controller.abort();
    return reply;
  });
  await expect(consumer.greet(input(), controller.signal)).rejects.toThrow(
    'aborted',
  );
  expect(state.native).toHaveBeenCalledTimes(when === 'before' ? 0 : 1);
});

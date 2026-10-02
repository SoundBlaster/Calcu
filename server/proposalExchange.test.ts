// @vitest-environment node
import { JsonDocument } from '@0al/agent-surface';
import { describe, expect, it, vi } from 'vitest';
import { ProposalExchange } from './fixtures/proposalExchange';
import { canonicalHash } from './hash';

const HASH = `sha-256:${'A'.repeat(43)}`;
const limits = { request: 8192, response: 8192 };
const seed = () => ({
  binding: {
    session_id: 'session',
    session_generation: 1,
    grant_id: 'grant',
    grant_hash: HASH,
    app_id: 'app',
    surface_version: '1',
    surface_hash: HASH,
    subject: { user: 'user' },
    delegate: { runtime: 'runtime', agent: 'agent' },
    audience: 'https://127.0.0.1/agent-actions',
    identity_evidence_hash: HASH,
  },
  trace_id: '1234567890abcdef1234567890abcdef',
  span_id: '1234567890abcdef',
  idempotency_key: 'idempotency',
  execution: { mode: 'propose', execution_id: 'execution' },
  input: { draft: 'Hello, world!' },
});
const document = (value: unknown) => new JsonDocument(JSON.stringify(value));
// This bare value exercises only representation. Real receipt policy and
// executor authentication are covered separately by the HTTPS comparison.
const receipt = () => document({ receipt_hash: HASH });
const exchange = (value = seed()) =>
  new ProposalExchange('greeting.propose', document(value), limits);

function response(request: string) {
  const {
    input: _input,
    runtime_receipt: _receipt,
    ...payload
  } = JSON.parse(request).payload;
  return {
    type: 'action.result',
    payload: {
      ...payload,
      result: 'success',
      output: { greeting: 'Hello, world!' },
      receipt: {},
    },
  };
}

describe('private proposal exchange representation', () => {
  it('keeps constructors inert and parses malformed raw input during preparation', () => {
    const producer = vi.fn(receipt);
    const value = new ProposalExchange(
      'greeting.propose',
      new JsonDocument('{'),
      limits,
    );
    expect(producer).not.toHaveBeenCalled();
    expect(() => value.prepare(producer)).toThrow();
    expect(producer).not.toHaveBeenCalled();
  });

  it('derives the existing input and execution domains without credentials or app code', () => {
    const draft = seed();
    const prepared = exchange(draft).prepare(receipt);
    const payload = JSON.parse(prepared.request()).payload;
    expect(payload.action_id).toBe('greeting.propose');
    expect(payload.input_hash).toBe(
      canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/action-input/v1',
        draft.input,
      ),
    );
    expect(payload.execution_hash).toBe(
      canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/action-execution/v1',
        draft.execution,
      ),
    );
    expect(payload.parent_receipt_hash).toBe(HASH);
    expect(payload).not.toHaveProperty('credential');
    expect(payload.input).toEqual(draft.input);
  });

  it.each([
    [
      'mode',
      (value: ReturnType<typeof seed>) => {
        value.execution.mode = 'commit';
      },
    ],
    [
      'generation',
      (value: ReturnType<typeof seed>) => {
        value.binding.session_generation = 0;
      },
    ],
    [
      'hash',
      (value: ReturnType<typeof seed>) => {
        value.binding.grant_hash = 'bad';
      },
    ],
    [
      'trace',
      (value: ReturnType<typeof seed>) => {
        value.trace_id = '0'.repeat(32);
      },
    ],
    [
      'span',
      (value: ReturnType<typeof seed>) => {
        value.span_id = 'not-a-span';
      },
    ],
    [
      'identity',
      (value: ReturnType<typeof seed>) => {
        value.binding.delegate.agent = '';
      },
    ],
    [
      'idempotency',
      (value: ReturnType<typeof seed>) => {
        value.idempotency_key = '';
      },
    ],
    [
      'execution',
      (value: ReturnType<typeof seed>) => {
        value.execution.execution_id = '';
      },
    ],
  ] as const)('rejects invalid %s before receipt production', (_name, change) => {
    const value = seed();
    change(value);
    const producer = vi.fn(receipt);
    expect(() => exchange(value).prepare(producer)).toThrow();
    expect(producer).not.toHaveBeenCalled();
  });

  it.each([
    'draft',
    'binding',
    'subject',
    'execution',
  ])('rejects extra %s fields before receipt production', (level) => {
    const value = seed();
    const target =
      level === 'draft'
        ? value
        : level === 'subject'
          ? value.binding.subject
          : level === 'binding'
            ? value.binding
            : value.execution;
    Object.assign(target, { credential: 'must-not-be-wire-authority' });
    const producer = vi.fn(receipt);
    expect(() => exchange(value).prepare(producer)).toThrow();
    expect(producer).not.toHaveBeenCalled();
  });

  it('rejects duplicate raw fields and negative zero before serialization can erase them', () => {
    for (const raw of [
      JSON.stringify(seed()).replace(
        '"session_generation":1',
        '"session_generation":1,"session_generation":1',
      ),
      JSON.stringify(seed()).replace('"draft":"Hello, world!"', '"draft":-0'),
    ]) {
      const producer = vi.fn(receipt);
      expect(() =>
        new ProposalExchange(
          'greeting.propose',
          new JsonDocument(raw),
          limits,
        ).prepare(producer),
      ).toThrow();
      expect(producer).not.toHaveBeenCalled();
    }
  });

  it('takes byte limits from the trusted composition and snapshots them', () => {
    const selected = { ...limits };
    const value = new ProposalExchange(
      'greeting.propose',
      document(seed()),
      selected,
    );
    selected.request = 1;
    expect(value.prepare(receipt).request()).toContain('action.request');
    const producer = vi.fn(receipt);
    expect(() =>
      new ProposalExchange('greeting.propose', document(seed()), {
        request: 32,
        response: 8192,
      }).prepare(producer),
    ).toThrow();
    expect(producer).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid limit %s before production', (limit) => {
    const producer = vi.fn(receipt);
    expect(() =>
      new ProposalExchange('greeting.propose', document(seed()), {
        request: 8192,
        response: limit,
      }).prepare(producer),
    ).toThrow();
    expect(producer).not.toHaveBeenCalled();
  });

  it('bounds the complete request including the supplied receipt', () => {
    expect(() =>
      exchange().prepare(() =>
        document({ receipt_hash: HASH, extra: 'x'.repeat(7800) }),
      ),
    ).toThrow();
  });

  it.each([
    null,
    [],
    { receipt_hash: 'bad' },
    { receipt_hash: null },
  ])('rejects unusable parent receipt %j', (value) => {
    expect(() => exchange().prepare(() => document(value))).toThrow();
  });

  it('owns caller and callback values before using them as future expectations', () => {
    const original = seed();
    const value = exchange(original);
    original.input.draft = 'changed before prepare';
    const prepared = value.prepare((context) => {
      context.subject.user = 'changed in producer';
      context.execution.execution_id = 'changed in producer';
      return receipt();
    });
    const payload = JSON.parse(prepared.request()).payload;
    expect(payload.input.draft).toBe('Hello, world!');
    expect(payload.subject.user).toBe('user');
    expect(payload.execution.execution_id).toBe('execution');
    const reply = JSON.stringify(response(prepared.request()));
    prepared.readResult(reply, (_output, _receipt, evidence) => {
      evidence.context.subject.user = 'changed in reader';
      evidence.context.execution.execution_id = 'changed in reader';
    });
    prepared.readResult(reply, (output, _receipt, evidence) => {
      expect(evidence.context.subject.user).toBe('user');
      expect(evidence.context.execution.execution_id).toBe('execution');
      expect(evidence.outputHash).toBe(
        canonicalHash(
          'https://github.com/0al-spec/agent-surface/hash/action-output/v1',
          output,
        ),
      );
    });
  });

  it.each([
    'session_id',
    'session_generation',
    'grant_id',
    'grant_hash',
    'app_id',
    'surface_version',
    'surface_hash',
    'subject',
    'delegate',
    'audience',
    'identity_evidence_hash',
    'action_id',
    'trace_id',
    'span_id',
    'idempotency_key',
    'parent_receipt_hash',
    'input_hash',
    'execution',
    'execution_hash',
    'result',
  ])('rejects mismatched %s before the host reader', (field) => {
    const prepared = exchange().prepare(receipt);
    const reply = response(prepared.request());
    reply.payload[field] = 'changed';
    const reader = vi.fn();
    expect(() => prepared.readResult(JSON.stringify(reply), reader)).toThrow();
    expect(reader).not.toHaveBeenCalled();
  });

  it.each([
    'type',
    'extra-envelope',
    'extra-payload',
    'malformed',
    'duplicate',
    'oversized',
    'nested-extra',
    'nested-value',
  ])('rejects %s results before the host reader', (kind) => {
    const prepared = exchange().prepare(receipt);
    const reply = response(prepared.request());
    if (kind === 'type') reply.type = 'model.answer';
    if (kind === 'extra-envelope') Object.assign(reply, { extra: true });
    if (kind === 'extra-payload') reply.payload.extra = true;
    if (kind === 'oversized') reply.payload.output.greeting = '💬'.repeat(4096);
    if (kind === 'nested-extra') reply.payload.delegate.extra = true;
    if (kind === 'nested-value') reply.payload.delegate.agent = 'another';
    let raw = JSON.stringify(reply);
    if (kind === 'malformed') raw = '{';
    if (kind === 'duplicate')
      raw = raw.replace('"type":', '"type":"action.result","type":');
    const reader = vi.fn();
    expect(() => prepared.readResult(raw, reader)).toThrow();
    expect(reader).not.toHaveBeenCalled();
  });

  it('accepts reordered object members without changing saved expectations', () => {
    const prepared = exchange().prepare(receipt);
    const reply = response(prepared.request());
    reply.payload.delegate = { agent: 'agent', runtime: 'runtime' };
    reply.payload.execution = { execution_id: 'execution', mode: 'propose' };
    const reader = vi.fn(() => 'accepted');
    expect(prepared.readResult(JSON.stringify(reply), reader)).toBe('accepted');
    expect(reader).toHaveBeenCalledOnce();
  });

  it.each([
    'unicode',
    'missing',
    'case',
  ])('does not normalize %s binding values', (kind) => {
    const draft = seed();
    draft.binding.delegate.agent = 'caf\u00e9';
    const prepared = exchange(draft).prepare(receipt);
    const reply = response(prepared.request());
    if (kind === 'unicode') reply.payload.delegate.agent = 'cafe\u0301';
    if (kind === 'missing') delete reply.payload.execution.mode;
    if (kind === 'case')
      reply.payload.audience = 'https://127.0.0.1/AGENT-ACTIONS';
    const reader = vi.fn();
    expect(() => prepared.readResult(JSON.stringify(reply), reader)).toThrow(
      'invalid_response',
    );
    expect(reader).not.toHaveBeenCalled();
  });

  it('hashes input values without reordering arrays, normalizing strings or inserting defaults', () => {
    const inputHash = (input: unknown) => {
      const draft = { ...seed(), input };
      const prepared = new ProposalExchange(
        'greeting.propose',
        document(draft),
        limits,
      ).prepare(receipt);
      return JSON.parse(prepared.request()).payload.input_hash;
    };
    const input = {
      names: ['Ada', 'caf\u00e9'],
      style: { prefix: 'Hello', punctuation: '!' },
    };
    expect(inputHash(input)).toBe(
      inputHash({
        style: { punctuation: '!', prefix: 'Hello' },
        names: input.names,
      }),
    );
    expect(inputHash(input)).not.toBe(
      inputHash({ ...input, names: [...input.names].reverse() }),
    );
    expect(inputHash(input)).not.toBe(
      inputHash({ ...input, names: ['Ada', 'cafe\u0301'] }),
    );
    expect(inputHash(input)).not.toBe(
      inputHash({ ...input, style: { prefix: 'Hello' } }),
    );
  });

  it('requires the explicit host reader and propagates its rejection', () => {
    const prepared = exchange().prepare(receipt);
    expect(() =>
      prepared.readResult(JSON.stringify(response(prepared.request())), () => {
        throw new Error('host_policy_rejected');
      }),
    ).toThrow('host_policy_rejected');
  });
});

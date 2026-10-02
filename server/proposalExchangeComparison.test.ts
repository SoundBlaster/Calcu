// @vitest-environment node
import { JsonDocument } from '@0al/agent-surface';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Calculation } from './calcu';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { createCalcuExecutor, surface, type Transport } from './executor';
import { ProposalExchange } from './fixtures/proposalExchange';
import {
  candidateReceiptHistory,
  createProposalExchangeBackend,
} from './fixtures/proposalExchangeBackend';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
  type VerifiedIdentity,
} from './identity';
import { createLocalBackend, localReceiptHistory } from './localBackend';
import { verifyApplicationReceipt } from './receipts';
import { createAuthenticatedHttpsTransport } from './transport';

const START = Date.parse('2026-10-02T00:00:00Z');
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;
let tls: Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>;
let otherTls: Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>;
const cleanup: Array<() => Promise<void>> = [];
beforeAll(async () => {
  tls = await createDevelopmentTlsMaterial();
  otherTls = await createDevelopmentTlsMaterial();
});
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
afterAll(async () => {
  await tls.dispose();
  await otherTls.dispose();
});

async function fixture(candidate: boolean) {
  let time = START;
  let onVerify = (value: VerifiedIdentity) => value;
  const identity = createTestIdentityFixture(START);
  const verifier = createTestIdentityVerifier(identity);
  const executor = createCalcuExecutor({
    now: () => time,
    identityVerifier: {
      verify(value, now) {
        return onVerify(verifier.verify(value, now));
      },
    },
  });
  const access = executor.issue({
    subject: { user: 'exchange-user' },
    delegate: { runtime: 'exchange-runtime', agent: identity.evidence.subject },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: surface.credential_audience,
    expires_at: START + 60_000,
  });
  const host = createActionHttpsServer(executor, {
    key: tls.key,
    cert: tls.cert,
  });
  cleanup.push(async () => {
    executor.retire();
    await host.close();
  });
  await host.listen();
  const address = host.server.address();
  if (!address || typeof address === 'string')
    throw new Error('fixture_failed');
  const endpoint = `https://127.0.0.1:${address.port}/agent-actions`;
  const transport = createAuthenticatedHttpsTransport({
    endpoint,
    ca: tls.cert,
  });
  const create = candidate ? createProposalExchangeBackend : createLocalBackend;
  return {
    executor,
    access,
    identity,
    transport,
    endpoint,
    backend: (selected: Transport = transport, now = () => START) =>
      create(access, selected, now),
    history: candidate ? candidateReceiptHistory : localReceiptHistory,
    setTime: (next: number) => {
      time = next;
    },
    duringVerification: (callback: typeof onVerify) => {
      onVerify = callback;
    },
  };
}

it('reconstructs the production request byte-for-byte and reads its real HTTPS result', async () => {
  const state = await fixture(false);
  let request = '';
  let response = '';
  await state
    .backend(async (credential, body, signal) => {
      request = body;
      response = await state.transport(credential, body, signal);
      return response;
    })
    .calculationPropose(input);
  const { payload } = JSON.parse(request);
  const {
    action_id,
    trace_id,
    span_id,
    idempotency_key,
    input: wireInput,
    execution,
    input_hash: _inputHash,
    execution_hash: _executionHash,
    parent_receipt_hash: _parent,
    runtime_receipt,
    ...binding
  } = payload;
  const candidate = new ProposalExchange(
    action_id,
    new JsonDocument(
      JSON.stringify({
        binding,
        trace_id,
        span_id,
        idempotency_key,
        execution,
        input: wireInput,
      }),
    ),
    { request: 8192, response: 8192 },
  ).prepare(() => new JsonDocument(JSON.stringify(runtime_receipt)));
  expect(candidate.request()).toBe(request);
  candidate.readResult(response, (output, receipt, evidence) => {
    expect(output).toEqual({ ...input, result: 36 });
    // The recorded action is known to be Calcu's one action; narrowing here
    // is test composition, not an authority decision made by the candidate.
    verifyApplicationReceipt(receipt, {
      ...evidence,
      context: { ...evidence.context, action_id: 'calculation.propose' },
    });
  });
  expect(state.executor.engineCalls).toBe(1);
});

describe.each([
  false,
  true,
])('real HTTPS proposal exchange; candidate=%s', (candidate) => {
  it('returns 36, records both receipts and keeps authority out of body/output', async () => {
    const state = await fixture(candidate);
    let request = '';
    const backend = state.backend(async (credential, body, signal) => {
      request = body;
      return state.transport(credential, body, signal);
    });
    const output = await backend.calculationPropose(input);
    expect(output).toEqual({ ...input, result: 36 });
    expect(state.executor.engineCalls).toBe(1);
    expect(request).not.toContain(state.access.credential);
    expect(Object.keys(backend)).toEqual(['calculationPropose']);
    expect(JSON.stringify(output)).not.toContain(state.access.credential);
    expect(JSON.stringify(output)).not.toContain(state.access.binding.grant_id);
    const receipts = state.history(backend);
    expect(receipts.map((item) => item.receipt_type)).toEqual([
      'runtime',
      'app',
    ]);
    expect(receipts[1].parent_receipt_hash).toBe(receipts[0].receipt_hash);
  });

  it.each([
    'revoke',
    'generation',
    'retire',
    'Grant deadline',
    'identity deadline',
    'identity revoked',
    'identity unavailable',
  ])('retains independent %s rejection before engine entry', async (event) => {
    const state = await fixture(candidate);
    if (event === 'identity revoked') state.identity.setStatus('revoked');
    if (event === 'identity unavailable')
      state.identity.setStatus('unavailable');
    state.duringVerification((verified) => {
      if (event === 'revoke') state.executor.revoke(state.access.credential);
      if (event === 'generation')
        state.executor.rotateSession(state.access.credential);
      if (event === 'retire') state.executor.retire();
      if (event === 'Grant deadline') state.setTime(START + 60_000);
      if (event === 'identity deadline') {
        state.setTime(START + 20);
        return { ...verified, status_valid_until: START + 10 };
      }
      return verified;
    });
    const backend = state.backend();
    await expect(backend.calculationPropose(input)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
    expect(state.history(backend).map((item) => item.receipt_type)).toEqual([
      'runtime',
    ]);
  });

  it.each([
    'subject',
    'delegate',
    'session_generation',
    'grant_hash',
    'surface_hash',
    'action_id',
    'mode',
    'input',
    'receipt',
    'credential',
  ])('lets the real executor reject changed request %s with zero entries', async (kind) => {
    const state = await fixture(candidate);
    const backend = state.backend(async (credential, body, signal) => {
      const request = JSON.parse(body);
      if (kind === 'mode') request.payload.execution.mode = 'commit';
      else if (kind === 'input') request.payload.input.operator = 'sqrt';
      else if (kind === 'receipt')
        request.payload.runtime_receipt.receipt_hash = 'bad';
      else
        request.payload[kind] = kind === 'credential' ? credential : 'changed';
      return state.transport(credential, JSON.stringify(request), signal);
    });
    await expect(backend.calculationPropose(input)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
  });

  it.each([
    'correlation',
    'output',
    'receipt hash',
    'policy decision',
    'output hash',
    'extra',
    'type',
    'duplicate',
    'malformed',
    'oversized',
  ])('rejects changed response %s after one real engine entry', async (kind) => {
    const state = await fixture(candidate);
    const backend = state.backend(async (credential, body, signal) => {
      const raw = await state.transport(credential, body, signal);
      const response = JSON.parse(raw);
      if (kind === 'correlation') response.payload.session_generation++;
      if (kind === 'output') response.payload.output.left = 18;
      if (kind === 'receipt hash')
        response.payload.receipt.receipt_hash = 'bad';
      if (kind === 'policy decision')
        response.payload.receipt.policy_decision.policy.id = 'forged';
      if (kind === 'output hash') response.payload.receipt.output_hash = 'bad';
      if (kind === 'extra') response.payload.output.credential = credential;
      if (kind === 'type') response.type = 'model.answer';
      if (kind === 'oversized') return ' '.repeat(8193);
      if (kind === 'malformed') return '{';
      if (kind === 'duplicate')
        return raw.replace('"type":', '"type":"action.result","type":');
      return JSON.stringify(response);
    });
    await expect(backend.calculationPropose(input)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(1);
    expect(state.history(backend).map((item) => item.receipt_type)).toEqual([
      'runtime',
    ]);
  });

  it('rejects an older successful response and preserves quota across new facades', async () => {
    const state = await fixture(candidate);
    let first = '';
    const backend = state.backend(async (credential, body, signal) => {
      const response = await state.transport(credential, body, signal);
      first ||= response;
      return first;
    });
    await backend.calculationPropose(input);
    await expect(backend.calculationPropose(input)).rejects.toThrow(
      'invalid_response',
    );
    expect(state.executor.engineCalls).toBe(2);
    expect(state.history(backend).map((item) => item.receipt_type)).toEqual([
      'runtime',
      'app',
      'runtime',
    ]);
    expect(await state.backend().calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });

  it('snapshots arguments and host binding across clock and transport callbacks', async () => {
    const state = await fixture(candidate);
    const mutable: Calculation = { ...input };
    const backend = state.backend(
      async (credential, body, signal) => {
        mutable.left = 400;
        return state.transport(credential, body, signal);
      },
      () => {
        mutable.left = 320;
        return START;
      },
    );
    state.access.binding.subject.user = 'caller-mutated';
    state.access.binding.delegate.agent = 'caller-mutated';
    expect(await backend.calculationPropose(mutable)).toEqual({
      ...input,
      result: 36,
    });
    expect(Object.isFrozen(mutable)).toBe(false);
    expect(state.executor.engineCalls).toBe(1);
  });

  it('rejects unsupported domain input before send', async () => {
    const state = await fixture(candidate);
    let sends = 0;
    const backend = state.backend(async (...args) => {
      sends++;
      return state.transport(...args);
    });
    await expect(
      backend.calculationPropose({ ...input, operator: 'sqrt' }),
    ).rejects.toThrow('schema_invalid');
    expect(sends).toBe(0);
    expect(state.executor.engineCalls).toBe(0);
  });

  it('observes pre-send cancellation without receipts or engine calls', async () => {
    const state = await fixture(candidate);
    const controller = new AbortController();
    controller.abort();
    const backend = state.backend();
    await expect(
      backend.calculationPropose(input, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(0);
    expect(state.history(backend)).toEqual([]);
  });

  it('rejects cancelled delivery after execution without refunding quota', async () => {
    const state = await fixture(candidate);
    const controller = new AbortController();
    const backend = state.backend(async (credential, body, signal) => {
      const response = await state.transport(credential, body, signal);
      controller.abort();
      return response;
    });
    await expect(
      backend.calculationPropose(input, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(1);
    expect(state.history(backend).map((item) => item.receipt_type)).toEqual([
      'runtime',
    ]);
    await state.backend().calculationPropose(input);
    await state.backend().calculationPropose(input);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });

  it('uses authenticated TLS and rejects an untrusted certificate before execution', async () => {
    const state = await fixture(candidate);
    const transport = createAuthenticatedHttpsTransport({
      endpoint: state.endpoint,
      ca: otherTls.cert,
    });
    await expect(
      state.backend(transport).calculationPropose(input),
    ).rejects.toThrow('transport_error');
    expect(state.executor.engineCalls).toBe(0);
  });

  it('preserves the application error after an invalid mathematical result', async () => {
    const state = await fixture(candidate);
    await expect(
      state
        .backend()
        .calculationPropose({ operator: 'divide', left: 1, right: 0 }),
    ).rejects.toThrow('action_rejected');
    expect(state.executor.engineCalls).toBe(1);
  });
});

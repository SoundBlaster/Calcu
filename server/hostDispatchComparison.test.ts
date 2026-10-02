// @vitest-environment node
import { JsonDocument } from '@0al/agent-surface';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Calculation, CalculationResult } from './calcu';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { createCalcuExecutor, surface } from './executor';
import { ExplicitCalculationBinding } from './fixtures/explicitCalculationBinding';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
  type VerifiedIdentity,
} from './identity';
import { createLocalBackend, localReceiptHistory } from './localBackend';
import { preparedSurface } from './manifest';
import { createAuthenticatedHttpsTransport } from './transport';

// Replace ONLY the existing native function connection inside this test file.
// All real admission, lifecycle, quota, receipts and TLS stay in the executor.
const connection = vi.hoisted(() => ({
  handler: undefined as ((input: Calculation) => CalculationResult) | undefined,
}));
vi.mock('./calcu', async (original) => {
  const native = await original<typeof import('./calcu')>();
  return {
    ...native,
    calculate: (input: Calculation) =>
      connection.handler ? connection.handler(input) : native.calculate(input),
  };
});

const START = Date.parse('2026-10-02T00:00:00Z');
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;
const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  connection.handler = undefined;
});

function binding(handler: (value: Calculation) => CalculationResult) {
  return new ExplicitCalculationBinding(
    preparedSurface,
    new JsonDocument(
      JSON.stringify({
        action_id: surface.action.id,
        mode: 'propose',
        surface_hash: surface.surface_hash,
      }),
    ),
    handler,
  );
}

async function fixture(candidate: boolean) {
  const native = await vi.importActual<typeof import('./calcu')>('./calcu');
  let time = START;
  let onVerify = (verified: VerifiedIdentity) => verified;
  let onClock = () => {};
  let entries = 0;
  let handlerTime = START;
  const handler = (value: Calculation) => {
    entries++;
    handlerTime = time;
    return native.calculate(value);
  };
  connection.handler = candidate ? binding(handler).prepare() : handler;
  const identity = createTestIdentityFixture(START);
  const verifier = createTestIdentityVerifier(identity);
  const executor = createCalcuExecutor({
    now: () => {
      const sample = time;
      onClock();
      return sample;
    },
    identityVerifier: {
      verify(value, now) {
        return onVerify(verifier.verify(value, now));
      },
    },
  });
  const access = executor.issue({
    subject: { user: 'private-comparison-user' },
    delegate: {
      runtime: 'private-comparison-host',
      agent: identity.evidence.subject,
    },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: surface.credential_audience,
    expires_at: START + 60_000,
  });
  const tls = await createDevelopmentTlsMaterial();
  cleanup.push(() => tls.dispose());
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
  const transport = createAuthenticatedHttpsTransport({
    endpoint: `https://127.0.0.1:${address.port}/agent-actions`,
    ca: tls.cert,
  });
  return {
    executor,
    access,
    identity,
    transport,
    backend: () => createLocalBackend(access, transport, () => START),
    duringVerification: (callback: typeof onVerify) => {
      onVerify = callback;
    },
    duringClock: (callback: typeof onClock) => {
      onClock = callback;
    },
    setTime: (value: number) => {
      time = value;
    },
    observe: () => ({ entries, handlerTime }),
  };
}

describe('P5-T9A-H private binding preparation', () => {
  it('is inert and returns only the trusted test host native connection', () => {
    const handler = vi.fn();
    expect(binding(handler).prepare()).toBe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    'action_id',
    'mode',
    'surface_hash',
  ])('rejects changed %s without entry', (field) => {
    const handler = vi.fn();
    const selection = {
      action_id: surface.action.id,
      mode: 'propose',
      surface_hash: surface.surface_hash,
      [field]: 'changed',
    };
    const candidate = new ExplicitCalculationBinding(
      preparedSurface,
      new JsonDocument(JSON.stringify(selection)),
      handler,
    );
    expect(() => candidate.prepare()).toThrow('binding_mismatch');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe.each([
  false,
  true,
])('real HTTPS host; private candidate=%s', (candidate) => {
  it('returns correlated 36 with existing Runtime and App Receipts', async () => {
    const state = await fixture(candidate);
    const backend = state.backend();
    expect(await backend.calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    expect(state.executor.engineCalls).toBe(1);
    expect(state.observe().entries).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime', 'app']);
  });

  it.each([
    'Grant',
    'identity',
    'revoke',
    'rotate',
    'retire',
  ] as const)('rejects %s before native entry', async (event) => {
    const state = await fixture(candidate);
    state.duringVerification((verified) => {
      if (event === 'Grant') state.setTime(START + 60_000);
      if (event === 'identity') {
        state.setTime(START + 20);
        return { ...verified, status_valid_until: START + 10 };
      }
      if (event === 'revoke') state.executor.revoke(state.access.credential);
      if (event === 'rotate')
        state.executor.rotateSession(state.access.credential);
      if (event === 'retire') state.executor.retire();
      return verified;
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
    expect(state.observe().entries).toBe(0);
  });

  it('retains current lifecycle checks after clock callback re-entry', async () => {
    const state = await fixture(candidate);
    state.duringVerification((verified) => {
      state.duringClock(() => state.executor.revoke(state.access.credential));
      return verified;
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(0);
    expect(state.observe().entries).toBe(0);
  });

  it('cancels before sending with zero native entries', async () => {
    const state = await fixture(candidate);
    const controller = new AbortController();
    controller.abort();
    await expect(
      state.backend().calculationPropose(input, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(0);
    expect(state.observe().entries).toBe(0);
  });

  it('does not treat client cancellation as synchronously observed server cancellation', async () => {
    const state = await fixture(candidate);
    const controller = new AbortController();
    state.duringVerification((verified) => {
      // Abort closes the CLIENT request. Its socket event cannot interrupt
      // this already-running synchronous server admission/handler turn.
      controller.abort();
      return verified;
    });
    const backend = state.backend();
    await expect(
      backend.calculationPropose(input, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(1);
    expect(state.observe().entries).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime']);
    state.duringVerification((verified) => verified);
    for (let attempt = 0; attempt < 2; attempt++)
      await state.backend().calculationPropose(input);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });

  it('uses returned authorization sample, not a physical entry deadline promise', async () => {
    const state = await fixture(candidate);
    state.duringVerification((verified) => {
      // Deterministic clock model: sample first, then elapsed callback time.
      // No actual sleep or claim about OS scheduling is needed.
      state.duringClock(() => state.setTime(START + 60_000));
      return { ...verified, status_valid_until: START + 20 };
    });
    const backend = state.backend();
    expect(await backend.calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    expect(state.observe()).toEqual({
      entries: 1,
      handlerTime: START + 60_000,
    });
    expect(localReceiptHistory(backend)[1].timestamp).toBe(
      new Date(START).toISOString(),
    );
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(1);
  });

  it('preserves caller input custody and does not expose sqrt', async () => {
    const state = await fixture(candidate);
    const owned = { ...input, left: Number(input.left) };
    state.duringVerification((verified) => {
      owned.left = 111;
      return verified;
    });
    expect(await state.backend().calculationPropose(owned)).toEqual({
      ...input,
      result: 36,
    });
    expect(owned.left).toBe(111);
    expect(Object.isFrozen(owned)).toBe(false);
    await expect(
      state
        .backend()
        .calculationPropose({ operator: 'sqrt', left: 111, right: 2 }),
    ).rejects.toThrow('schema_invalid');
    expect(state.executor.engineCalls).toBe(1);
    expect(state.observe().entries).toBe(1);
  });

  it('keeps host quota across recreated mediators and failed native output', async () => {
    const state = await fixture(candidate);
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        state
          .backend()
          .calculationPropose({ operator: 'divide', left: 1, right: 0 }),
      ).rejects.toThrow('action_rejected'); // Existing safe HTTP error projection.
    }
    expect(state.observe().entries).toBe(3);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
    expect(state.observe().entries).toBe(3);
  });

  it.each([
    'cancel',
    'substituted-output',
  ] as const)('retains entry when %s prevents result acceptance', async (failure) => {
    const state = await fixture(candidate);
    const controller = new AbortController();
    const backend = createLocalBackend(
      state.access,
      async (credential, body, signal) => {
        const source = await state.transport(credential, body, signal);
        if (failure === 'cancel') {
          controller.abort();
          return source;
        }
        const response = JSON.parse(source);
        response.payload.output.left = 111;
        return JSON.stringify(response);
      },
      () => START,
    );
    await expect(
      backend.calculationPropose(input, controller.signal),
    ).rejects.toThrow(failure === 'cancel' ? 'aborted' : 'invalid_response');
    expect(state.executor.engineCalls).toBe(1);
    expect(state.observe().entries).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime']);
    for (let attempt = 0; attempt < 2; attempt++)
      await state.backend().calculationPropose(input);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });
});

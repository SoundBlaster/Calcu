// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCalcuExecutor, surface } from './executor';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
  type VerifiedIdentity,
} from './identity';
import { createLocalBackend, localReceiptHistory } from './localBackend';

const START = Date.parse('2026-10-02T00:00:00Z');
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;

function fixture() {
  let time = START;
  let onVerify = (verified: VerifiedIdentity) => verified;
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
    subject: { user: 'handler-qualification-user' },
    delegate: {
      runtime: 'handler-qualification-runtime',
      agent: identity.evidence.subject,
    },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: surface.credential_audience,
    expires_at: START + 60_000,
  });
  const backend = () => createLocalBackend(access, executor.invoke, () => time);
  return {
    executor,
    access,
    backend,
    setTime: (value: number) => {
      time = value;
    },
    duringVerification: (callback: typeof onVerify) => {
      onVerify = callback;
    },
  };
}

describe('P5-T9A: merged Calcu dispatch characterization (not extraction)', () => {
  it.each([
    'revoke',
    'rotate',
    'retire',
    'cancel',
  ] as const)('rejects re-entrant %s before function entry', async (event) => {
    const state = fixture();
    const controller = new AbortController();
    state.duringVerification((verified) => {
      if (event === 'revoke') state.executor.revoke(state.access.credential);
      if (event === 'rotate')
        state.executor.rotateSession(state.access.credential);
      if (event === 'retire') state.executor.retire();
      if (event === 'cancel') controller.abort();
      return verified;
    });
    await expect(
      state.backend().calculationPropose(input, controller.signal),
    ).rejects.toThrow(
      event === 'cancel' ? 'aborted' : /unauthorized|binding_mismatch/,
    );
    expect(state.executor.engineCalls).toBe(0);
  });

  // Exact baseline observation, NOT the desired security contract. Change this
  // characterization and add a zero-entry regression in the separately scoped fix.
  it('records the known gap: Grant expires during verifier but one call enters', async () => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.setTime(START + 60_000);
      return verified;
    });
    expect(await state.backend().calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    expect(state.executor.engineCalls).toBe(1);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(1);
  });

  it('records the known gap: identity freshness elapses during verifier before entry', async () => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.setTime(START + 20);
      return { ...verified, status_valid_until: START + 10 };
    });
    expect(await state.backend().calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    expect(state.executor.engineCalls).toBe(1);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'identity_evidence_expired',
    );
    expect(state.executor.engineCalls).toBe(1);
  });

  it('rejects expiry already present at request entry', async () => {
    const state = fixture();
    state.setTime(START + 60_000);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(0);
  });

  it('shares the final quota slot across recreated mediators and simultaneous requests', async () => {
    const state = fixture();
    await state.backend().calculationPropose(input);
    await state.backend().calculationPropose(input);
    const outcomes = await Promise.allSettled([
      state.backend().calculationPropose(input),
      state.backend().calculationPropose(input),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(1);
    expect(state.executor.engineCalls).toBe(3);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
  });

  it('records correct captured execution but rejected presentation after caller mutation', async () => {
    const state = fixture();
    const owned = { ...input, left: Number(input.left) };
    let executed: unknown;
    const backend = createLocalBackend(
      state.access,
      async (credential, body, signal) => {
        const response = await state.executor.invoke(credential, body, signal);
        executed = JSON.parse(response).payload.output;
        return response;
      },
      () => START,
    );
    state.duringVerification((verified) => {
      owned.left = 111;
      return verified;
    });
    await expect(backend.calculationPropose(owned)).rejects.toThrow(
      'invalid_response',
    );
    expect(executed).toEqual({
      ...input,
      result: 36,
    });
    expect(owned.left).toBe(111);
    expect(state.executor.engineCalls).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime']);
  });

  it('counts invalid mathematical output as function entry and does not refund quota', async () => {
    const state = fixture();
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        state
          .backend()
          .calculationPropose({ operator: 'divide', left: 1, right: 0 }),
      ).rejects.toThrow('invalid_result');
    }
    expect(state.executor.engineCalls).toBe(3);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
  });

  it('counts a completed action even when delivery is cancelled; no App Receipt is accepted', async () => {
    const state = fixture();
    const controller = new AbortController();
    const backend = createLocalBackend(
      state.access,
      async (credential, body, signal) => {
        const response = await state.executor.invoke(credential, body, signal);
        controller.abort();
        return response;
      },
      () => START,
    );
    await expect(
      backend.calculationPropose(input, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime']);
  });
});

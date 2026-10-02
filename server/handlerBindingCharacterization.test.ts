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
  let onClock = () => {};
  const identity = createTestIdentityFixture(START);
  const verifier = createTestIdentityVerifier(identity);
  const executor = createCalcuExecutor({
    now: () => {
      onClock();
      return time;
    },
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
    duringClock: (callback: typeof onClock) => {
      onClock = callback;
    },
  };
}

describe('P5-T9A-F: Calcu dispatch and input custody regressions', () => {
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

  it('rejects Grant expiry during verification before function entry', async () => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.setTime(START + 60_000);
      return verified;
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(0);
  });

  it('rejects identity-only freshness expiry with an unexpired Grant before entry', async () => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.setTime(START + 20);
      return { ...verified, status_valid_until: START + 10 };
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'identity_evidence_expired',
    );
    expect(state.executor.engineCalls).toBe(0);
    // Refreshing verifier evidence does not mint another Grant or reset quota.
    state.duringVerification((verified) => verified);
    for (let attempt = 0; attempt < 3; attempt++)
      await state.backend().calculationPropose(input);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });

  it.each([
    'revoke',
    'rotate',
    'retire',
    'cancel',
  ] as const)('rechecks lifecycle after dispatch clock re-entrant %s', async (event) => {
    const state = fixture();
    const controller = new AbortController();
    let clockCalled = false;
    state.duringVerification((verified) => {
      state.duringClock(() => {
        clockCalled = true;
        if (event === 'revoke') state.executor.revoke(state.access.credential);
        if (event === 'rotate')
          state.executor.rotateSession(state.access.credential);
        if (event === 'retire') state.executor.retire();
        if (event === 'cancel') controller.abort();
      });
      return verified;
    });
    await expect(
      state.backend().calculationPropose(input, controller.signal),
    ).rejects.toThrow(
      event === 'cancel' ? 'aborted' : /unauthorized|binding_mismatch/,
    );
    expect(clockCalled).toBe(true);
    expect(state.executor.engineCalls).toBe(0);
  });

  it.each([
    NaN,
    Infinity,
    -Infinity,
  ])('rejects non-finite dispatch clock %s before entry', async (time) => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.duringClock(() => state.setTime(time));
      return verified;
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(state.executor.engineCalls).toBe(0);
  });

  it('accepts fresh dispatch time and records it in the App Receipt', async () => {
    const state = fixture();
    let checks = 0;
    state.duringVerification((verified) => {
      checks++;
      state.setTime(START + 1_000);
      return verified;
    });
    const backend = state.backend();
    expect(await backend.calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
    expect(checks).toBe(1); // No recursive re-verification loop at dispatch.
    const [runtimeReceipt, appReceipt] = localReceiptHistory(backend);
    expect(runtimeReceipt.timestamp).toBe(new Date(START).toISOString());
    expect(appReceipt.timestamp).toBe(new Date(START + 1_000).toISOString());
    expect(state.executor.engineCalls).toBe(1);
  });

  it.each([
    NaN,
    Infinity,
    -Infinity,
  ])('rejects non-finite verified freshness %s before entry', async (until) => {
    const state = fixture();
    state.duringVerification((verified) => ({
      ...verified,
      status_valid_until: until,
    }));
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'identity_evidence_expired',
    );
    expect(state.executor.engineCalls).toBe(0);
  });

  it('rejects a throwing dispatch clock before entry without consuming quota', async () => {
    const state = fixture();
    state.duringVerification((verified) => {
      state.duringClock(() => {
        throw new Error('clock_unavailable');
      });
      return verified;
    });
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'clock_unavailable',
    );
    expect(state.executor.engineCalls).toBe(0);
    state.duringVerification((verified) => verified);
    state.duringClock(() => {});
    for (let attempt = 0; attempt < 3; attempt++)
      await state.backend().calculationPropose(input);
    await expect(state.backend().calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
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

  it('keeps execution and presentation bound to a snapshot despite caller mutation', async () => {
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
    expect(await backend.calculationPropose(owned)).toEqual({
      ...input,
      result: 36,
    });
    expect(executed).toEqual({
      ...input,
      result: 36,
    });
    expect(owned.left).toBe(111);
    expect(Object.isFrozen(owned)).toBe(false);
    expect(state.executor.engineCalls).toBe(1);
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime', 'app']);
  });

  it('captures caller input across an asynchronously suspended response', async () => {
    const state = fixture();
    const owned = { ...input, left: Number(input.left) };
    let entered = () => {};
    let release = () => {};
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const backend = createLocalBackend(
      state.access,
      async (credential, body, signal) => {
        const response = await state.executor.invoke(credential, body, signal);
        entered();
        await resume;
        return response;
      },
      () => START,
    );
    const operation = backend.calculationPropose(owned);
    await ready;
    try {
      owned.left = 111;
      expect(state.executor.engineCalls).toBe(1);
      expect(Object.isFrozen(owned)).toBe(false);
    } finally {
      release();
    }
    expect(await operation).toEqual({ ...input, result: 36 });
    expect(
      localReceiptHistory(backend).map((receipt) => receipt.receipt_type),
    ).toEqual(['runtime', 'app']);
  });

  it('captures input before the mediator clock callback can mutate caller values', async () => {
    const state = fixture();
    const owned = { ...input, left: Number(input.left) };
    const backend = createLocalBackend(
      state.access,
      state.executor.invoke,
      () => {
        owned.left = 111;
        return START;
      },
    );
    expect(await backend.calculationPropose(owned)).toEqual({
      ...input,
      result: 36,
    });
    expect(owned.left).toBe(111);
    expect(Object.isFrozen(owned)).toBe(false);
    expect(state.executor.engineCalls).toBe(1);
  });

  it('still rejects changed response operands after caller input is mutated', async () => {
    const state = fixture();
    const owned = { ...input, left: Number(input.left) };
    const backend = createLocalBackend(
      state.access,
      async (credential, body, signal) => {
        const response = JSON.parse(
          await state.executor.invoke(credential, body, signal),
        );
        owned.left = 111;
        response.payload.output.left = 111;
        return JSON.stringify(response);
      },
      () => START,
    );
    await expect(backend.calculationPropose(owned)).rejects.toThrow(
      'invalid_response',
    );
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

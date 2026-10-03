// @vitest-environment node
import { JsonDocument, SurfaceSnapshot } from '@0al/agent-surface';
import { OfflineInlineProposalExchange } from '@0al/offline-proposal-exchange-experiment';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createDevelopmentTlsMaterial } from './developmentTls';
import type { Transport } from './executor';
import { createCalcuExecutor, surface as defaultSurface } from './executor';
import { canonicalHash } from './hash';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
  type VerifiedIdentity,
} from './identity';
import { createInlineProposalBackend } from './inlineProposalBackend';
import { INLINE_EXTENSION, INLINE_PROFILE } from './inlineReceiptWire';
import { localReceiptHistory } from './localBackend';
import {
  preparedSurface as defaultPreparedSurface,
  prepareInlineCalcuSurface,
} from './manifest';
import { createAuthenticatedHttpsTransport } from './transport';

const START = Date.parse('2026-10-03T00:00:00Z');
const EXPIRY = START + 60_000;
const INPUT = { operator: 'multiply', left: 240, right: 0.15 } as const;
const RECEIPT_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/receipt/v1';

type Wire = { type: string; payload: Record<string, unknown> };
type Pilot = Awaited<ReturnType<typeof openPilot>>;

let tls: Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>;
let otherTls: Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>;
const openServers: Array<ReturnType<typeof createActionHttpsServer>> = [];
const openExecutors: Array<ReturnType<typeof createCalcuExecutor>> = [];

beforeAll(async () => {
  tls = await createDevelopmentTlsMaterial();
  otherTls = await createDevelopmentTlsMaterial();
});

afterEach(async () => {
  for (const executor of openExecutors.splice(0)) executor.retire();
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});

afterAll(async () => {
  await tls.dispose();
  await otherTls.dispose();
});

async function openPilot() {
  let now = START;
  let onVerified = (verified: VerifiedIdentity) => verified;
  const identity = createTestIdentityFixture(START);
  const verifier = createTestIdentityVerifier(identity);
  let executor: ReturnType<typeof createCalcuExecutor>;
  const host = createActionHttpsServer(
    {
      invoke: (...args) => executor.invoke(...args),
    } as Pick<ReturnType<typeof createCalcuExecutor>, 'invoke'>,
    { key: tls.key, cert: tls.cert },
  );
  openServers.push(host);
  await host.listen();
  const address = host.server.address();
  if (!address || typeof address === 'string')
    throw new Error('inline_pilot_setup_failed');
  const endpoint = `https://127.0.0.1:${address.port}/agent-actions`;
  const prepared = prepareInlineCalcuSurface(
    'calcu.local',
    `https://127.0.0.1:${address.port}`,
  );
  executor = createCalcuExecutor({
    now: () => now,
    identityVerifier: {
      verify(value, verificationTime) {
        return onVerified(verifier.verify(value, verificationTime));
      },
    },
    preparedSurface: prepared,
  });
  openExecutors.push(executor);
  const access = executor.issue({
    subject: { user: 'inline-pilot-user' },
    delegate: {
      runtime: 'inline-pilot-runtime',
      agent: identity.evidence.subject,
    },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: prepared.surface.credential_audience,
    expires_at: EXPIRY,
  });
  const selectedGrant = executor.selectedGrant(access.credential);
  selectedGrant.validate();
  const transport = createAuthenticatedHttpsTransport({
    endpoint,
    ca: tls.cert,
  });
  const backend = (selected: Transport = transport) =>
    createInlineProposalBackend(
      access,
      prepared,
      selectedGrant,
      selected,
      () => now,
    );
  return {
    executor,
    access,
    identity,
    prepared,
    selectedGrant,
    endpoint,
    transport,
    backend,
    setNow(value: number) {
      now = value;
    },
    duringVerification(callback: typeof onVerified) {
      onVerified = callback;
    },
  };
}

function parseWire(body: string): Wire {
  return JSON.parse(body) as Wire;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('test_wire_object_required');
  return value as Record<string, unknown>;
}

function extension(payload: Record<string, unknown>) {
  return object(payload[INLINE_EXTENSION]);
}

function receipt(payload: Record<string, unknown>) {
  return object(extension(payload).app_receipt);
}

function requestTamper(state: Pilot, mutate: (wire: Wire) => void): Transport {
  return (credential, body, signal) => {
    const wire = parseWire(body);
    mutate(wire);
    return state.transport(credential, JSON.stringify(wire), signal);
  };
}

function responseTamper(state: Pilot, mutate: (wire: Wire) => void): Transport {
  return async (credential, body, signal) => {
    const response = await state.transport(credential, body, signal);
    const wire = parseWire(response);
    mutate(wire);
    return JSON.stringify(wire);
  };
}

function rehashAppReceipt(
  wire: Wire,
  mutate: (app: Record<string, unknown>) => void,
) {
  const app = receipt(wire.payload);
  mutate(app);
  const view = { ...app };
  delete view.receipt_hash;
  const hash = canonicalHash(RECEIPT_HASH_DOMAIN, view);
  app.receipt_hash = hash;
  wire.payload.receipt_hash = hash;
}

describe('opt-in HTTP inline receipt pilot over loopback HTTPS', () => {
  it('rejects real independently valid Grant/manifest cross-mixing before transport', async () => {
    const a = await openPilot();
    const b = await openPilot();
    a.selectedGrant.validateFor(a.prepared.manifest);
    b.selectedGrant.validateFor(b.prepared.manifest);
    expect(a.prepared.manifest.hash()).not.toBe(b.prepared.manifest.hash());
    const mixedAccess = {
      ...b.access,
      binding: {
        ...b.access.binding,
        grant_id: a.access.binding.grant_id,
        grant_hash: a.access.binding.grant_hash,
      },
    };
    let sends = 0;
    const backend = createInlineProposalBackend(
      mixedAccess,
      b.prepared,
      a.selectedGrant,
      async () => {
        sends += 1;
        throw new Error('unexpected_transport');
      },
      () => START,
    );
    await expect(backend.calculationPropose(INPUT)).rejects.toThrow(
      /^grant_manifest_binding_mismatch$/,
    );
    expect(sends).toBe(0);
    expect(a.executor.engineCalls).toBe(0);
    expect(b.executor.engineCalls).toBe(0);
  });

  it.each([
    [[]],
    [['other.action']],
    [['calculation.propose', 'calculation.propose']],
  ])('rejects a self-consistent host descriptor selecting %j', (actionIds) => {
    const original = prepareInlineCalcuSurface();
    const value = original.document.parse() as {
      agent_api: Record<string, unknown>;
      surface_hash: string;
    };
    value.agent_api.receipt_delivery = {
      profile: INLINE_PROFILE,
      action_ids: actionIds,
    };
    const { surface_hash: _oldHash, ...hashView } = value;
    const hash = new SurfaceSnapshot(
      new JsonDocument(JSON.stringify(hashView)),
    ).hash();
    value.surface_hash = hash;
    const document = new JsonDocument(JSON.stringify(value));
    // Deliberately malformed trusted composition, NOT a valid prepared SDK value.
    // A real OfflineProposalManifest already rejects this; Calcu also fails closed.
    const malformed = {
      ...original,
      document,
      surface: { ...original.surface, surface_hash: hash },
      manifest: {
        document,
        surfaceHash: hash,
        actionId: original.manifest.actionId,
        hash: () => hash,
        validateInput: original.manifest.validateInput.bind(original.manifest),
        validateOutput: original.manifest.validateOutput.bind(
          original.manifest,
        ),
      },
    };
    const identity = createTestIdentityFixture(START);
    expect(() =>
      createCalcuExecutor({
        preparedSurface: malformed,
        identityVerifier: createTestIdentityVerifier(identity),
      }),
    ).toThrow('binding_mismatch');
  });

  it('keeps the default surface unselected and opts in with a hash-bound descriptor', () => {
    const defaultManifest =
      defaultPreparedSurface.manifest.document.parse() as {
        agent_api: Record<string, unknown>;
      };
    expect(defaultSurface.surface_version).toBe('0.1.3');
    expect(defaultManifest.agent_api).not.toHaveProperty('receipt_delivery');

    const inline = prepareInlineCalcuSurface();
    const manifest = inline.manifest.document.parse() as {
      agent_api: { receipt_delivery: Record<string, unknown> };
    };
    expect(inline.surface.surface_version).toBe('0.1.4-inline-pilot');
    expect(manifest.agent_api.receipt_delivery).toEqual({
      profile: INLINE_PROFILE,
      action_ids: ['calculation.propose'],
    });
    expect(inline.manifest.hash()).toBe(inline.surface.surface_hash);
  });

  it('uses real prepared manifest/Grant and carries only complete namespaced receipts', async () => {
    const state = await openPilot();
    let requestBody = '';
    let responseBody = '';
    const capture: Transport = async (credential, body, signal) => {
      requestBody = body;
      responseBody = await state.transport(credential, body, signal);
      return responseBody;
    };
    const backend = state.backend(capture);
    await expect(backend.calculationPropose(INPUT)).resolves.toEqual({
      ...INPUT,
      result: 36,
    });

    expect(state.prepared.manifest.surfaceHash).toBe(
      state.prepared.surface.surface_hash,
    );
    expect(state.prepared.manifest.document.parse()).toEqual(
      expect.objectContaining({
        agent_api: expect.objectContaining({
          action_url: state.endpoint,
          receipt_delivery: {
            profile: INLINE_PROFILE,
            action_ids: ['calculation.propose'],
          },
        }),
      }),
    );
    expect(state.selectedGrant.hash()).toBe(state.access.binding.grant_hash);

    const request = parseWire(requestBody);
    const requestCarrier = extension(request.payload);
    expect(request.type).toBe('action.request');
    expect(requestCarrier.profile).toBe(INLINE_PROFILE);
    expect(Object.keys(requestCarrier).sort()).toEqual(
      ['profile', 'runtime_receipt'].sort(),
    );
    expect(requestCarrier.runtime_receipt).toEqual(
      expect.objectContaining({ receipt_type: 'runtime' }),
    );
    expect(request.payload).not.toHaveProperty('runtime_receipt');
    expect(request.payload).not.toHaveProperty('grant');
    expect(request.payload).not.toHaveProperty('credential');
    expect(requestBody).not.toContain(state.access.credential);

    const response = parseWire(responseBody);
    const responseCarrier = extension(response.payload);
    const appReceipt = object(responseCarrier.app_receipt);
    expect(response.type).toBe('action.result');
    expect(responseCarrier.profile).toBe(INLINE_PROFILE);
    expect(Object.keys(responseCarrier).sort()).toEqual(
      ['profile', 'app_receipt'].sort(),
    );
    expect(appReceipt.receipt_type).toBe('app');
    expect(response.payload.receipt_id).toBe(appReceipt.receipt_id);
    expect(response.payload.receipt_hash).toBe(appReceipt.receipt_hash);
    expect(response.payload).not.toHaveProperty('receipt');
    expect(response.payload).not.toHaveProperty('grant');
    expect(response.payload).not.toHaveProperty('credential');
    expect(responseBody).not.toContain(state.access.credential);
    expect(Object.keys(backend)).toEqual(['calculationPropose']);
    const history = localReceiptHistory(backend);
    expect(history.map((value) => value.receipt_type)).toEqual([
      'runtime',
      'app',
    ]);
    expect(history[1].parent_receipt_hash).toBe(history[0].receipt_hash);
    expect(JSON.stringify(await backend.calculationPropose(INPUT))).not.toMatch(
      /credential|grant|receipt/u,
    );
  });

  const badRequests: Array<[string, (wire: Wire) => void]> = [
    ['missing carrier', (wire) => delete wire.payload[INLINE_EXTENSION]],
    [
      'wrong profile',
      (wire) => {
        extension(wire.payload).profile = `${INLINE_PROFILE}/other`;
      },
    ],
    [
      'unknown carrier member',
      (wire) => {
        extension(wire.payload).extra = true;
      },
    ],
    [
      'hash-only Runtime Receipt',
      (wire) => {
        extension(wire.payload).runtime_receipt = 'sha-256:bad';
      },
    ],
    [
      'partial Runtime Receipt',
      (wire) => {
        delete object(extension(wire.payload).runtime_receipt).policy_decision;
      },
    ],
    [
      'raw legacy Runtime Receipt member',
      (wire) => {
        wire.payload.runtime_receipt = extension(wire.payload).runtime_receipt;
      },
    ],
    [
      'input substitution',
      (wire) => {
        object(wire.payload.input).operator = 'add';
      },
    ],
    [
      'action substitution',
      (wire) => {
        wire.payload.action_id = 'calculation.other';
      },
    ],
    [
      'generation substitution',
      (wire) => {
        wire.payload.session_generation = 2;
      },
    ],
    [
      'Grant hash substitution',
      (wire) => {
        wire.payload.grant_hash =
          'sha-256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      },
    ],
  ];

  it.each(
    badRequests,
  )('rejects a tampered request: %s before engine entry', async (_name, mutate) => {
    const state = await openPilot();
    const backend = state.backend(requestTamper(state, mutate));
    await expect(backend.calculationPropose(INPUT)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
  });

  const badResponses: Array<[string, (wire: Wire) => void]> = [
    [
      'extra carrier field',
      (wire) => {
        extension(wire.payload).extra = true;
      },
    ],
    [
      'URL substitute',
      (wire) => {
        extension(wire.payload).app_receipt = 'https://example.invalid/receipt';
      },
    ],
    [
      'raw legacy member',
      (wire) => {
        wire.payload.receipt = receipt(wire.payload);
      },
    ],
    [
      'rehash-consistent subject mismatch',
      (wire) => {
        rehashAppReceipt(wire, (app) => {
          object(app.subject).user = 'other';
        });
      },
    ],
    ['missing carrier', (wire) => delete wire.payload[INLINE_EXTENSION]],
    [
      'wrong profile',
      (wire) => {
        extension(wire.payload).profile = `${INLINE_PROFILE}/other`;
      },
    ],
    [
      'partial App Receipt',
      (wire) => {
        delete receipt(wire.payload).policy_decision;
      },
    ],
    [
      'hash-only App Receipt',
      (wire) => {
        extension(wire.payload).app_receipt = 'sha-256:bad';
      },
    ],
    [
      'rehash-consistent parent mismatch',
      (wire) => {
        rehashAppReceipt(wire, (app) => {
          app.parent_receipt_hash =
            'sha-256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
        });
      },
    ],
    [
      'output mismatch',
      (wire) => {
        rehashAppReceipt(wire, (app) => {
          app.output_hash =
            'sha-256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
        });
      },
    ],
  ];

  it.each(
    badResponses,
  )('rejects a tampered response: %s after one engine entry', async (_name, mutate) => {
    const state = await openPilot();
    const backend = state.backend(responseTamper(state, mutate));
    await expect(backend.calculationPropose(INPUT)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(1);
  });

  it.each([
    [
      'revocation',
      (state: Pilot) => state.executor.revoke(state.access.credential),
    ],
    [
      'session generation rotation',
      (state: Pilot) => state.executor.rotateSession(state.access.credential),
    ],
    ['revoked identity', (state: Pilot) => state.identity.setStatus('revoked')],
    [
      'unavailable identity',
      (state: Pilot) => state.identity.setStatus('unavailable'),
    ],
    ['expired Grant', (state: Pilot) => state.setNow(EXPIRY)],
  ])('preserves live authority rejection across fresh facades: %s', async (_name, change) => {
    const state = await openPilot();
    change(state);
    await expect(state.backend().calculationPropose(INPUT)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
  });

  it.each([
    'revoke',
    'generation',
    'retire',
    'expiry',
    'identity deadline',
  ])('retains final admission fence during verifier reentry: %s', async (event) => {
    const state = await openPilot();
    state.duringVerification((verified) => {
      if (event === 'revoke') state.executor.revoke(state.access.credential);
      if (event === 'generation')
        state.executor.rotateSession(state.access.credential);
      if (event === 'retire') state.executor.retire();
      if (event === 'expiry') state.setNow(EXPIRY);
      if (event === 'identity deadline') {
        state.setNow(START + 20);
        return { ...verified, status_valid_until: START + 10 };
      }
      return verified;
    });
    await expect(state.backend().calculationPropose(INPUT)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(0);
  });

  it('does not refund quota after inline response rejection and preserves quota across new backends', async () => {
    const state = await openPilot();
    const rejected = state.backend(
      responseTamper(state, (wire) => {
        delete wire.payload[INLINE_EXTENSION];
      }),
    );
    await expect(rejected.calculationPropose(INPUT)).rejects.toThrow();
    expect(state.executor.engineCalls).toBe(1);

    await state.backend().calculationPropose(INPUT);
    await state.backend().calculationPropose(INPUT);
    await expect(state.backend().calculationPropose(INPUT)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.executor.engineCalls).toBe(3);
  });

  it('rejects an untrusted CA before executor entry', async () => {
    const state = await openPilot();
    const wrongTrust = createAuthenticatedHttpsTransport({
      endpoint: state.endpoint,
      ca: otherTls.cert,
    });
    await expect(
      state.backend(wrongTrust).calculationPropose(INPUT),
    ).rejects.toThrow('transport_error');
    expect(state.executor.engineCalls).toBe(0);
  });

  it('rejects late delivery cancellation after real execution without claiming rollback', async () => {
    const state = await openPilot();
    const controller = new AbortController();
    const lateAbort: Transport = async (credential, body, signal) => {
      const response = await state.transport(credential, body, signal);
      controller.abort();
      return response;
    };
    await expect(
      state.backend(lateAbort).calculationPropose(INPUT, controller.signal),
    ).rejects.toThrow('aborted');
    expect(state.executor.engineCalls).toBe(1);
  });

  it('keeps SDK integrity assurance distinct from producer authentication', async () => {
    const state = await openPilot();
    let requestBody = '';
    let responseBody = '';
    await state
      .backend(async (credential, body, signal) => {
        requestBody = body;
        responseBody = await state.transport(credential, body, signal);
        return responseBody;
      })
      .calculationPropose(INPUT);
    const request = parseWire(requestBody);
    const payload = request.payload;
    const expected = new JsonDocument(
      JSON.stringify({
        session_id: state.access.binding.session_id,
        session_generation: state.access.binding.session_generation,
        grant_id: state.access.binding.grant_id,
        grant_hash: state.access.binding.grant_hash,
        surface_hash: state.prepared.surface.surface_hash,
        action_id: 'calculation.propose',
        idempotency_key: payload.idempotency_key,
        trace_id: payload.trace_id,
        span_id: payload.span_id,
        input_hash: payload.input_hash,
        execution: payload.execution,
        execution_hash: payload.execution_hash,
        app_id: state.access.binding.app_id,
        surface_version: state.access.binding.surface_version,
        runtime: { runtime_id: state.access.binding.delegate.runtime },
        actor_agent: {
          agent_id: state.access.binding.delegate.agent,
          identity_evidence_hash: state.access.binding.identity_evidence_hash,
        },
        subject: state.access.binding.subject,
        policies: {
          runtime: { id: 'calcu-runtime-admission', version: '0.1.0' },
          application: { id: 'calcu-app-admission', version: '0.1.0' },
        },
      }),
    );
    const checked = new OfflineInlineProposalExchange(
      state.prepared.manifest,
      state.selectedGrant,
      new JsonDocument(requestBody),
      expected,
      8192,
    )
      .prepare()
      .checkReceiptIntegrity(new JsonDocument(responseBody));
    expect(checked.status).toBe('integrity_checked');
    expect(checked.assurance.producer_authentication).toBe('not_verified');
    expect(checked.assurance.current_authority).toBe('not_verified');
  });
});

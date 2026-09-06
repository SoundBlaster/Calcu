// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCalcuExecutor, surface, type Transport } from './executor';
import { canonicalHash } from './hash';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
} from './identity';
import { createLocalBackend } from './localBackend';

const START = Date.parse('2026-09-05T00:00:00Z');
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;

function setup() {
  let time = START;
  const identity = createTestIdentityFixture(START);
  const app = createCalcuExecutor({
    now: () => time,
    identityVerifier: createTestIdentityVerifier(identity),
  });
  const access = app.issue({
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
  let captured = '';
  const backend = createLocalBackend(
    access,
    async (credential, body, signal) => {
      captured = body;
      if (signal?.aborted) throw new Error('aborted');
      return app.invoke(credential, body, signal);
    },
  );
  return {
    app,
    access,
    identity,
    backend,
    capture: async () => {
      await backend.calculationPropose(input);
      return JSON.parse(captured);
    },
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
  };
}

describe('LocalBackend → ASP Grant/session-bound Calcu executor', () => {
  it('rejects a legacy-domain verifier result before engine execution', async () => {
    const identity = createTestIdentityFixture(START);
    const verifier = createTestIdentityVerifier(identity);
    let checks = 0;
    const app = createCalcuExecutor({
      now: () => START,
      identityVerifier: {
        verify(value, now) {
          const verified = verifier.verify(value, now);
          checks += 1;
          return checks === 1
            ? verified
            : {
                ...verified,
                identity_evidence_hash: canonicalHash(
                  'https://github.com/0al-spec/agent-surface/hash/identity-evidence/v1',
                  verified.evidence,
                ),
              };
        },
      },
    });
    const access = app.issue({
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
    expect(access.binding.session_generation).toBe(1);
    expect(access.binding.identity_evidence_hash).toBe(
      canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/agent-identity-evidence/v1',
        identity.evidence,
      ),
    );
    const backend = createLocalBackend(access, (credential, body, signal) =>
      app.invoke(credential, body, signal),
    );
    await expect(backend.calculationPropose(input)).rejects.toThrow(
      'identity_evidence_invalid',
    );
    expect(checks).toBe(2);
    expect(app.engineCalls).toBe(0);
  });

  it('requires fresh issuance after executor restart', async () => {
    const first = setup();
    const fresh = setup();
    const backend = createLocalBackend(
      first.access,
      (credential, body, signal) => fresh.app.invoke(credential, body, signal),
    );
    await expect(backend.calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
    expect(fresh.app.engineCalls).toBe(0);
    expect(fresh.access.binding.grant_id).not.toBe(
      first.access.binding.grant_id,
    );
    expect(fresh.access.binding.session_id).not.toBe(
      first.access.binding.session_id,
    );
    expect(first.access.binding.session_generation).toBe(1);
    expect(fresh.access.binding.session_generation).toBe(1);
    expect(await fresh.backend.calculationPropose(input)).toEqual({
      ...input,
      result: 36,
    });
  });

  it('returns actual Calcu output without exposing authority', async () => {
    const { app, backend, access } = setup();
    const output = await backend.calculationPropose(input);
    expect(output).toEqual({ ...input, result: 36 });
    expect(app.engineCalls).toBe(1);
    expect(Object.keys(backend)).toEqual(['calculationPropose']);
    expect(JSON.stringify(output)).not.toContain(access.credential);
    expect(JSON.stringify(output)).not.toContain(access.binding.grant_id);
  });

  it.each([
    'missing',
    'identifier',
    'other-grant',
    'revoked',
    'expired',
    'session',
  ])('rejects %s authority before the engine', async (kind) => {
    const state = setup();
    const request = await state.capture();
    let credential = state.access.credential;
    if (kind === 'missing') credential = '';
    if (kind === 'identifier') credential = state.access.binding.grant_id;
    if (kind === 'other-grant')
      credential = state.app.issue({
        subject: { user: 'calcu-user-local' },
        delegate: {
          runtime: 'calcu-runtime-local',
          agent: state.identity.evidence.subject,
        },
        identity: {
          evidence: state.identity.evidence,
          artifactBytes: state.identity.artifactBytes,
        },
        audience: surface.credential_audience,
        expires_at: Date.parse('2026-09-05T00:00:59Z'),
      }).credential;
    if (kind === 'revoked') state.app.revoke(credential);
    if (kind === 'expired') state.advance(60_001);
    if (kind === 'session') state.app.rotateSession(credential);
    await expect(
      state.app.invoke(credential, JSON.stringify(request)),
    ).rejects.toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it.each([
    'session_id',
    'session_generation',
    'grant_id',
    'grant_hash',
    'surface_hash',
    'subject',
    'delegate',
    'audience',
    'identity_evidence_hash',
    'action_id',
    'trace_id',
    'span_id',
  ])('rejects altered %s even when bypassing LocalBackend', async (key) => {
    const state = setup();
    const request = await state.capture();
    request.payload[key] = 'substituted';
    await expect(
      state.app.invoke(state.access.credential, JSON.stringify(request)),
    ).rejects.toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it.each([
    null,
    {},
    [],
    { ...input, credential: 'agent-supplied' },
    { ...input, operator: 'eval' },
    { ...input, left: '240' },
    { ...input, right: null },
  ])('rejects invalid application input independently: %j', async (bad) => {
    const state = setup();
    const request = await state.capture();
    request.payload.input = bad;
    await expect(
      state.app.invoke(state.access.credential, JSON.stringify(request)),
    ).rejects.toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it('rejects non-finite tool arguments and result overflow', async () => {
    const { backend, app } = setup();
    await expect(
      backend.calculationPropose({ ...input, left: Infinity }),
    ).rejects.toThrow();
    expect(app.engineCalls).toBe(0);
    await expect(
      backend.calculationPropose({
        ...input,
        left: Number.MAX_VALUE,
        right: 2,
      }),
    ).rejects.toThrow('invalid_result');
    await expect(
      backend.calculationPropose({ operator: 'divide', left: 1, right: 0 }),
    ).rejects.toThrow('invalid_result');
  });

  it('rejects changed mode, extra envelope fields, malformed/oversized JSON', async () => {
    const state = setup();
    const request = await state.capture();
    for (const body of [
      '{',
      ' '.repeat(8193),
      JSON.stringify({ ...request, credential: 'extra' }),
      JSON.stringify({
        ...request,
        payload: { ...request.payload, execution: { mode: 'commit' } },
      }),
    ])
      await expect(
        state.app.invoke(state.access.credential, body),
      ).rejects.toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it('bounds calls in app-owned state across multiple backend instances', async () => {
    const state = setup();
    for (let i = 0; i < 3; i++) await state.backend.calculationPropose(input);
    const second = createLocalBackend(state.access, state.app.invoke);
    await expect(second.calculationPropose(input)).rejects.toThrow(
      'quota_exceeded',
    );
    expect(state.app.engineCalls).toBe(3);
  });

  it('does not share mutable authority with the mediator', async () => {
    const state = setup();
    state.access.binding.session_generation = 999;
    state.access.binding.subject.user = 'substituted-user';
    state.access.binding.delegate.agent = 'substituted-agent';
    expect((await state.backend.calculationPropose(input)).result).toBe(36);
    const changed = createLocalBackend(state.access, state.app.invoke);
    await expect(changed.calculationPropose(input)).rejects.toThrow(
      'binding_mismatch',
    );
  });

  it('snapshots identity evidence and artifact bytes at issuance', async () => {
    const state = setup();
    const requestIdentity: { evidence: unknown; artifactBytes: Uint8Array } = {
      evidence: structuredClone(state.identity.evidence),
      artifactBytes: new Uint8Array(state.identity.artifactBytes),
    };
    const access = state.app.issue({
      subject: { user: 'snapshot-user' },
      delegate: {
        runtime: 'snapshot-runtime',
        agent: state.identity.evidence.subject,
      },
      identity: requestIdentity,
      audience: surface.credential_audience,
      expires_at: START + 60_000,
    });
    requestIdentity.evidence = { profile: 'substituted' };
    requestIdentity.artifactBytes[0] ^= 0xff;
    await expect(
      state.app.invoke(access.credential, JSON.stringify({})),
    ).rejects.toThrow('schema_invalid');
    const backend = createLocalBackend(access, (credential, body, signal) =>
      state.app.invoke(credential, body, signal),
    );
    await expect(backend.calculationPropose(input)).resolves.toEqual({
      ...input,
      result: 36,
    });
  });

  it('binds the request to configured subject, delegate and audience', async () => {
    const state = setup();
    const request = await state.capture();
    expect(request.payload.subject).toEqual({ user: 'calcu-user-local' });
    expect(request.payload.delegate).toEqual({
      runtime: 'calcu-runtime-local',
      agent: state.identity.evidence.subject,
    });
    expect(request.payload.audience).toBe(surface.credential_audience);
    expect(request.payload.identity_evidence_hash).toMatch(/^sha-256:/);
    expect(request.payload.grant_hash).toMatch(/^sha-256:/);
    expect(request.payload.surface_hash).toMatch(/^sha-256:/);
  });

  it.each([
    'revoked',
    'expired',
    'unknown',
    'unavailable',
  ])('fails closed when identity status is %s', async (status) => {
    const state = setup();
    state.identity.setStatus(status as never, START + 300_000);
    await expect(state.backend.calculationPropose(input)).rejects.toThrow(
      `identity_evidence_${status}`,
    );
    expect(state.app.engineCalls).toBe(0);
  });

  it('rejects unsupported identity profile before issuing a Grant', () => {
    const state = setup();
    const identity = {
      evidence: {
        ...state.identity.evidence,
        verification_profile: 'https://calcu.local/profiles/unknown/v1',
      },
      artifactBytes: state.identity.artifactBytes,
    };
    expect(() =>
      state.app.issue({
        subject: { user: 'calcu-user-local' },
        delegate: {
          runtime: 'calcu-runtime-local',
          agent: state.identity.evidence.subject,
        },
        identity,
        audience: surface.credential_audience,
        expires_at: START + 60_000,
      }),
    ).toThrow('identity_evidence_profile_unsupported');
  });

  it('does not accept a caller-selected audience or credential in the body', async () => {
    const state = setup();
    expect(() =>
      state.app.issue({
        subject: { user: 'user' },
        delegate: {
          runtime: 'runtime',
          agent: state.identity.evidence.subject,
        },
        identity: {
          evidence: state.identity.evidence,
          artifactBytes: state.identity.artifactBytes,
        },
        audience: 'https://attacker.invalid/actions',
        expires_at: START + 60_000,
      }),
    ).toThrow('audience_mismatch');
    const request = await state.capture();
    request.payload.credential = state.access.credential;
    await expect(
      state.app.invoke(state.access.credential, JSON.stringify(request)),
    ).rejects.toThrow('schema_invalid');
  });

  it.each([
    'correlation',
    'output',
    'extra',
    'type',
    'malformed',
    'late',
  ])('does not accept %s response as current app result', async (kind) => {
    const state = setup();
    let previous = '';
    const transport: Transport = async (credential, body) => {
      const raw = await state.app.invoke(credential, body);
      const result = JSON.parse(raw);
      if (kind === 'correlation') result.payload.session_generation++;
      if (kind === 'output') result.payload.output.left = 18;
      if (kind === 'extra') result.payload.output.credential = credential;
      if (kind === 'type') result.type = 'model.answer';
      if (kind === 'malformed') return '{';
      if (kind === 'late') {
        const response = previous || raw;
        previous = raw;
        return response;
      }
      return JSON.stringify(result);
    };
    const backend = createLocalBackend(state.access, transport);
    if (kind === 'late') await backend.calculationPropose(input);
    await expect(backend.calculationPropose(input)).rejects.toThrow();
  });
});

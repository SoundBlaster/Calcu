import { randomBytes, randomUUID } from 'node:crypto';
import { calculate, exact, validateCalculation } from './calcu';
import { byteHash, canonicalHash } from './hash';
import type {
  IdentityEvidence,
  IdentityEvidenceVerifier,
  IdentityInput,
  VerifiedIdentity,
} from './identity';

export type SurfaceSnapshot = {
  surface_url: string;
  surface_version: string;
  surface_mode: 'proposal_only';
  actions: readonly ['calculation.propose'];
  scopes: readonly ['calculation.propose'];
  credential_audience: string;
  credential_release: { mode: 'deny' };
  action: {
    id: 'calculation.propose';
    execution: { mode: 'propose' };
    side_effect: false;
  };
  surface_hash: string;
};

const surfaceDefinition = {
  surface_url: 'https://calcu.local/agent-actions',
  surface_version: '0.1.0',
  surface_mode: 'proposal_only' as const,
  actions: Object.freeze(['calculation.propose']) as readonly [
    'calculation.propose',
  ],
  scopes: Object.freeze(['calculation.propose']) as readonly [
    'calculation.propose',
  ],
  credential_audience: 'https://calcu.local/agent-actions',
  credential_release: Object.freeze({ mode: 'deny' as const }),
  action: Object.freeze({
    id: 'calculation.propose' as const,
    execution: Object.freeze({ mode: 'propose' as const }),
    side_effect: false as const,
  }),
};
const SURFACE_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/manifest/v1';
const GRANT_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/grant/v1';
export const surface: SurfaceSnapshot = Object.freeze({
  ...surfaceDefinition,
  surface_hash: canonicalHash(SURFACE_HASH_DOMAIN, surfaceDefinition),
});

export type GrantRequest = {
  subject: { user: string };
  delegate: { runtime: string; agent: string };
  identity: IdentityInput;
  audience: string;
  expires_at: number;
};

export type GrantObject = {
  grant_id: string;
  grant_hash: string;
  subject: { user: string };
  delegate: {
    runtime: string;
    agent: string;
    identity_evidence: IdentityEvidence;
  };
  resource_server: {
    app_id: string;
    issuer: string;
    surface_version: string;
    surface_hash: string;
    credential_audience: string;
  };
  locations: readonly [string];
  actions: readonly ['calculation.propose'];
  scopes: readonly ['calculation.propose'];
  constraints: {
    expires_at: string;
    credential_release: { mode: 'deny' };
  };
  credential_profile: 'compatibility_bearer';
  credential_binding: {
    method: 'bearer';
    runtime_id: string;
    agent_id: string;
    identity_evidence_hash: string;
  };
};

export type SessionRecord = {
  session_id: string;
  session_generation: number;
  state: 'active' | 'revoked' | 'expired';
  grant_id: string;
  subject: { user: string };
  runtime_id: string;
  agent_id: string;
  surface_hash: string;
};

export type Binding = {
  session_id: string;
  session_generation: number;
  grant_id: string;
  grant_hash: string;
  surface_hash: string;
  subject: { user: string };
  delegate: { runtime: string; agent: string };
  audience: string;
  identity_evidence_hash: string;
};
export type RuntimeAccess = { credential: string; binding: Binding };
export type Transport = (
  credential: string,
  body: string,
  signal?: AbortSignal,
) => Promise<string>;

export type ExecutorOptions = {
  now?: () => number;
  identityVerifier: IdentityEvidenceVerifier;
  app_id?: string;
  issuer?: string;
};

type GrantRecord = {
  credentialHash: string;
  grant: GrantObject;
  grantHashInput: Omit<GrantObject, 'grant_hash'>;
  identityInput: IdentityInput;
  verifiedIdentity: VerifiedIdentity;
  session: SessionRecord;
  binding: Binding;
  expiresAt: number;
  active: boolean;
  remaining: number;
};

const cloneBinding = (binding: Binding): Binding => ({
  ...binding,
  subject: { ...binding.subject },
  delegate: { ...binding.delegate },
});
const credentialHash = (credential: string) =>
  byteHash(
    'calcu compatibility bearer credential v1',
    Buffer.from(credential, 'utf8'),
  );
const bindingEquals = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

function requiredIdentifier(value: unknown, code = 'schema_invalid'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256)
    throw new Error(code);
  return value;
}

function normalizeGrantRequest(value: unknown): GrantRequest {
  const request = exact(value, [
    'subject',
    'delegate',
    'identity',
    'audience',
    'expires_at',
  ]);
  const subject = exact(request.subject, ['user']);
  const delegate = exact(request.delegate, ['runtime', 'agent']);
  const identity = exact(request.identity, ['evidence', 'artifactBytes']);
  if (
    !(identity.artifactBytes instanceof Uint8Array) ||
    identity.artifactBytes.byteLength === 0 ||
    identity.artifactBytes.byteLength > 262_144
  )
    throw new Error('schema_invalid');
  let evidence: unknown;
  try {
    evidence = structuredClone(identity.evidence);
  } catch {
    throw new Error('schema_invalid');
  }
  return {
    subject: { user: subject.user as string },
    delegate: {
      runtime: delegate.runtime as string,
      agent: delegate.agent as string,
    },
    identity: {
      evidence,
      artifactBytes: new Uint8Array(identity.artifactBytes),
    },
    audience: request.audience as string,
    expires_at: request.expires_at as number,
  };
}

function grantHash(input: Omit<GrantObject, 'grant_hash'>) {
  return canonicalHash(GRANT_HASH_DOMAIN, input);
}

export function createCalcuExecutor({
  now = Date.now,
  identityVerifier,
  app_id = 'calcu.local',
  issuer = 'https://calcu.local',
}: ExecutorOptions) {
  const configuredAppId = requiredIdentifier(app_id);
  const configuredIssuer = requiredIdentifier(issuer);
  if (!identityVerifier || typeof identityVerifier.verify !== 'function')
    throw new Error('identity_evidence_unavailable');
  const grants = new Map<string, GrantRecord>();
  let engineCalls = 0;

  // Issuance is a trusted application control-plane operation. The caller must
  // provide a validated identity input; no default user/agent is synthesized.
  function issue(request: GrantRequest): RuntimeAccess {
    const trustedRequest = normalizeGrantRequest(request);
    const currentTime = now();
    if (!Number.isFinite(currentTime)) throw new Error('clock_unavailable');
    const subject = { user: requiredIdentifier(trustedRequest.subject.user) };
    const runtime = requiredIdentifier(trustedRequest.delegate.runtime);
    const agent = requiredIdentifier(trustedRequest.delegate.agent);
    const audience = requiredIdentifier(trustedRequest.audience);
    if (audience !== surface.credential_audience)
      throw new Error('audience_mismatch');
    if (
      !Number.isFinite(trustedRequest.expires_at) ||
      trustedRequest.expires_at <= currentTime ||
      trustedRequest.expires_at - currentTime > 60_000
    )
      throw new Error('grant_expired');
    const verifiedIdentity = identityVerifier.verify(
      trustedRequest.identity,
      currentTime,
    );
    if (verifiedIdentity.agent_uid !== agent)
      throw new Error('identity_agent_mismatch');
    if (verifiedIdentity.status_valid_until < trustedRequest.expires_at)
      throw new Error('identity_evidence_expired');
    let verifiedEvidence: IdentityEvidence;
    try {
      verifiedEvidence = structuredClone(verifiedIdentity.evidence);
    } catch {
      throw new Error('identity_evidence_invalid');
    }
    const grantHashInput: Omit<GrantObject, 'grant_hash'> = {
      grant_id: randomUUID(),
      subject,
      delegate: {
        runtime,
        agent,
        identity_evidence: verifiedEvidence,
      },
      resource_server: {
        app_id: configuredAppId,
        issuer: configuredIssuer,
        surface_version: surface.surface_version,
        surface_hash: surface.surface_hash,
        credential_audience: audience,
      },
      locations: [surface.surface_url],
      actions: [...surface.actions],
      scopes: [...surface.scopes],
      constraints: {
        expires_at: new Date(trustedRequest.expires_at).toISOString(),
        credential_release: { mode: 'deny' },
      },
      credential_profile: 'compatibility_bearer',
      credential_binding: {
        method: 'bearer',
        runtime_id: runtime,
        agent_id: agent,
        identity_evidence_hash: verifiedIdentity.identity_evidence_hash,
      },
    };
    const grant: GrantObject = {
      ...grantHashInput,
      grant_hash: grantHash(grantHashInput),
    };
    const session: SessionRecord = {
      session_id: randomUUID(),
      session_generation: 1,
      state: 'active',
      grant_id: grant.grant_id,
      subject: { ...subject },
      runtime_id: runtime,
      agent_id: agent,
      surface_hash: surface.surface_hash,
    };
    const binding: Binding = {
      session_id: session.session_id,
      session_generation: session.session_generation,
      grant_id: grant.grant_id,
      grant_hash: grant.grant_hash,
      surface_hash: surface.surface_hash,
      subject: { ...subject },
      delegate: { runtime, agent },
      audience,
      identity_evidence_hash: verifiedIdentity.identity_evidence_hash,
    };
    const credential = randomBytes(32).toString('base64url');
    const record: GrantRecord = {
      credentialHash: credentialHash(credential),
      grant,
      grantHashInput,
      identityInput: trustedRequest.identity,
      verifiedIdentity,
      session,
      binding,
      expiresAt: trustedRequest.expires_at,
      active: true,
      remaining: 3,
    };
    grants.set(record.credentialHash, record);
    return { credential, binding: cloneBinding(binding) };
  }

  const invoke: Transport = async (credential, body) => {
    if (typeof credential !== 'string' || credential.length !== 43)
      throw new Error('unauthorized');
    const record = grants.get(credentialHash(credential));
    const currentTime = now();
    if (
      !record ||
      !record.active ||
      record.session.state !== 'active' ||
      !Number.isFinite(currentTime) ||
      currentTime >= record.expiresAt
    ) {
      if (record && currentTime >= record.expiresAt) {
        record.active = false;
        record.session.state = 'expired';
      }
      throw new Error('unauthorized');
    }
    if (typeof body !== 'string' || Buffer.byteLength(body) > 8192)
      throw new Error('schema_invalid');
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      throw new Error('schema_invalid');
    }
    const envelope = exact(decoded, ['type', 'payload']);
    if (envelope.type !== 'action.request') throw new Error('schema_invalid');
    const payload = exact(envelope.payload, [
      ...Object.keys(record.binding),
      'action_id',
      'trace_id',
      'span_id',
      'execution',
      'input',
    ]);
    const currentIdentity = identityVerifier.verify(
      record.identityInput,
      currentTime,
    );
    if (
      currentIdentity.identity_evidence_hash !==
      record.verifiedIdentity.identity_evidence_hash
    )
      throw new Error('identity_evidence_invalid');
    if (currentIdentity.status_valid_until <= currentTime)
      throw new Error('identity_evidence_expired');
    if (grantHash(record.grantHashInput) !== record.grant.grant_hash)
      throw new Error('integrity_mismatch');
    const expectedBinding: Binding = {
      ...record.binding,
      session_generation: record.session.session_generation,
    };
    for (const key of Object.keys(expectedBinding) as (keyof Binding)[])
      if (!bindingEquals(payload[key], expectedBinding[key]))
        throw new Error('binding_mismatch');
    if (
      record.grant.credential_profile !== 'compatibility_bearer' ||
      record.grant.constraints.credential_release.mode !== 'deny' ||
      payload.action_id !== 'calculation.propose'
    )
      throw new Error('action_not_allowed');
    const execution = exact(payload.execution, ['mode']);
    if (execution.mode !== 'propose') throw new Error('action_not_allowed');
    if (
      typeof payload.trace_id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(payload.trace_id) ||
      /^0+$/.test(payload.trace_id) ||
      typeof payload.span_id !== 'string' ||
      !/^[a-f0-9]{16}$/.test(payload.span_id) ||
      /^0+$/.test(payload.span_id)
    )
      throw new Error('schema_invalid');
    const input = validateCalculation(payload.input);
    if (record.remaining <= 0) throw new Error('quota_exceeded');
    record.remaining--;
    engineCalls++;
    const output = calculate(input);
    return JSON.stringify({
      type: 'action.result',
      payload: {
        ...expectedBinding,
        action_id: 'calculation.propose',
        trace_id: payload.trace_id,
        span_id: payload.span_id,
        result: 'success',
        output,
      },
    });
  };

  function findRecord(value: string) {
    const byCredential = grants.get(credentialHash(value));
    if (byCredential) return byCredential;
    return [...grants.values()].find(
      (record) =>
        record.grant.grant_id === value || record.session.session_id === value,
    );
  }

  return {
    invoke,
    issue,
    revoke(value: string) {
      const record = findRecord(value);
      if (record) {
        record.active = false;
        record.session.state = 'revoked';
      }
    },
    rotateSession(value: string) {
      const record = findRecord(value);
      if (record) {
        record.session.session_generation++;
        record.session.state = 'revoked';
        record.active = false;
      }
    },
    get engineCalls() {
      return engineCalls;
    },
  };
}

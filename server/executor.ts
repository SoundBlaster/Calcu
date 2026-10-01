import { randomBytes, randomUUID } from 'node:crypto';
import {
  JsonDocument,
  OfflineSelectedGrant,
  OfflineSemanticGrantRequest,
  type PreparedOfflineSelectedGrant,
  type PreparedOfflineSemanticGrantRequest,
} from '@0al/agent-surface';
import { calculate, exact, validateCalculation } from './calcu';
import { serializeCalculationResponse } from './exposure';
import { byteHash, canonicalHash } from './hash';
import type {
  IdentityEvidence,
  IdentityEvidenceVerifier,
  IdentityInput,
  VerifiedIdentity,
} from './identity';

const GRANT_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/grant/v1';
const SEMANTIC_REQUEST_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/grant-request/v1';

import { prepareCalcuSurface } from './manifest';
import {
  createApplicationReceipt,
  type ReceiptContext,
  verifyRuntimeReceipt,
} from './receipts';

export { surface } from './manifest';

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
    identity_evidence: IdentityEvidence;
  };
  data_exposure: unknown[];
  audit: { local_receipt: 'required'; app_receipt: 'required' };
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
  app_id: string;
  surface_version: string;
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
  semanticRequest: PreparedOfflineSemanticGrantRequest;
  semanticRequestHash: string;
  selectedGrant: PreparedOfflineSelectedGrant;
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
  const preparedSurface = prepareCalcuSurface(
    configuredAppId,
    configuredIssuer,
  );
  const appSurface = preparedSurface.surface;
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
    if (audience !== appSurface.credential_audience)
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
    const expiresAt = new Date(trustedRequest.expires_at).toISOString();
    const semanticRequestValue = {
      locations: [appSurface.surface_url],
      actions: [...appSurface.actions],
      delegate: {
        runtime,
        agent,
        identity_evidence: verifiedEvidence,
      },
      resource_server: {
        app_id: configuredAppId,
        issuer: configuredIssuer,
        surface_version: appSurface.surface_version,
        surface_hash: appSurface.surface_hash,
      },
      scopes: [...appSurface.scopes],
      constraints: {
        expires_at: expiresAt,
        credential_release: { mode: 'deny' },
      },
      credential_profile: 'compatibility_bearer',
      audit: { local_receipt: 'required', app_receipt: 'required' },
    } as const;
    const semanticRequest = new OfflineSemanticGrantRequest(
      new JsonDocument(JSON.stringify(semanticRequestValue)),
      preparedSurface.manifest,
      {
        runtimeId: runtime,
        agentId: agent,
        identityEvidence: new JsonDocument(JSON.stringify(verifiedEvidence)),
      },
    ).prepare();
    const semanticRequestHash = semanticRequest.hash();
    const dataExposure = semanticRequest.dataExposure().parse() as unknown[];
    const grantHashInput: Omit<GrantObject, 'grant_hash'> = {
      grant_id: randomUUID(),
      subject,
      delegate: structuredClone(semanticRequestValue.delegate),
      resource_server: structuredClone(semanticRequestValue.resource_server),
      locations: [...semanticRequestValue.locations] as [string],
      actions: [...semanticRequestValue.actions] as ['calculation.propose'],
      scopes: [...semanticRequestValue.scopes] as ['calculation.propose'],
      constraints: structuredClone(semanticRequestValue.constraints),
      credential_profile: semanticRequestValue.credential_profile,
      credential_binding: {
        method: 'bearer',
        runtime_id: runtime,
        agent_id: agent,
        identity_evidence: structuredClone(verifiedEvidence),
      },
      data_exposure: dataExposure,
      audit: structuredClone(semanticRequestValue.audit),
    };
    const grant: GrantObject = {
      ...grantHashInput,
      grant_hash: grantHash(grantHashInput),
    };
    const selectedGrant = new OfflineSelectedGrant(
      new JsonDocument(JSON.stringify(grant)),
      preparedSurface.manifest,
      {
        subjectUser: subject.user,
        runtimeId: runtime,
        agentId: agent,
        credentialAudience: audience,
        identityEvidence: new JsonDocument(JSON.stringify(verifiedEvidence)),
      },
    ).prepare();
    selectedGrant.validate();
    semanticRequest.validate();
    if (
      selectedGrant.hash() !== grant.grant_hash ||
      semanticRequest.hash() !== semanticRequestHash ||
      canonicalHash(SEMANTIC_REQUEST_HASH_DOMAIN, semanticRequestValue) !==
        semanticRequestHash
    )
      throw new Error('integrity_mismatch');
    const session: SessionRecord = {
      session_id: randomUUID(),
      session_generation: 1,
      state: 'active',
      grant_id: grant.grant_id,
      subject: { ...subject },
      runtime_id: runtime,
      agent_id: agent,
      surface_hash: appSurface.surface_hash,
    };
    const binding: Binding = {
      session_id: session.session_id,
      session_generation: session.session_generation,
      grant_id: grant.grant_id,
      grant_hash: grant.grant_hash,
      app_id: configuredAppId,
      surface_version: appSurface.surface_version,
      surface_hash: appSurface.surface_hash,
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
      semanticRequest,
      semanticRequestHash,
      selectedGrant,
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
      decoded = new JsonDocument(body).parse(8192);
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
      'idempotency_key',
      'parent_receipt_hash',
      'runtime_receipt',
      'input_hash',
      'execution',
      'execution_hash',
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
    try {
      record.semanticRequest.validate();
      record.selectedGrant.validate();
    } catch {
      throw new Error('integrity_mismatch');
    }
    if (
      record.semanticRequest.hash() !== record.semanticRequestHash ||
      record.selectedGrant.hash() !== record.grant.grant_hash
    )
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
      payload.action_id !== appSurface.action.id
    )
      throw new Error('action_not_allowed');
    const execution = exact(payload.execution, ['mode', 'execution_id']);
    if (
      execution.mode !== appSurface.action.execution.mode ||
      typeof execution.execution_id !== 'string' ||
      execution.execution_id.length === 0 ||
      execution.execution_id.length > 128
    )
      throw new Error('action_not_allowed');
    if (
      typeof payload.trace_id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(payload.trace_id) ||
      /^0+$/.test(payload.trace_id) ||
      typeof payload.span_id !== 'string' ||
      !/^[a-f0-9]{16}$/.test(payload.span_id) ||
      /^0+$/.test(payload.span_id)
    )
      throw new Error('schema_invalid');
    if (
      typeof payload.idempotency_key !== 'string' ||
      payload.idempotency_key.length === 0 ||
      payload.idempotency_key.length > 128 ||
      typeof payload.parent_receipt_hash !== 'string' ||
      !/^sha-256:[A-Za-z0-9_-]{43}$/.test(payload.parent_receipt_hash)
    )
      throw new Error('schema_invalid');
    let inputHash: string;
    try {
      preparedSurface.manifest.validateInput(
        appSurface.action.id,
        new JsonDocument(JSON.stringify(payload.input)),
      );
      inputHash = canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/action-input/v1',
        payload.input,
      );
    } catch {
      throw new Error('schema_invalid');
    }
    if (payload.input_hash !== inputHash) throw new Error('integrity_mismatch');
    let executionHash: string;
    try {
      executionHash = canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/action-execution/v1',
        execution,
      );
    } catch {
      throw new Error('schema_invalid');
    }
    if (payload.execution_hash !== executionHash)
      throw new Error('integrity_mismatch');
    const input = validateCalculation(payload.input);
    const runtimeReceiptContext: ReceiptContext = {
      grant_id: record.grant.grant_id,
      grant_hash: record.grant.grant_hash,
      session_id: record.session.session_id,
      session_generation: record.session.session_generation,
      trace_id: payload.trace_id as string,
      span_id: payload.span_id as string,
      action_id: appSurface.action.id,
      app_id: configuredAppId,
      surface_version: appSurface.surface_version,
      surface_hash: appSurface.surface_hash,
      runtime_id: record.binding.delegate.runtime,
      agent_id: record.binding.delegate.agent,
      identity_evidence_hash: record.binding.identity_evidence_hash,
      user: record.binding.subject.user,
      idempotency_key: payload.idempotency_key as string,
      input_hash: inputHash,
      execution: {
        mode: 'propose',
        execution_id: execution.execution_id as string,
      },
      execution_hash: executionHash,
    };
    const runtimeReceipt = verifyRuntimeReceipt(
      payload.runtime_receipt,
      runtimeReceiptContext,
    );
    if (payload.parent_receipt_hash !== runtimeReceipt.receipt_hash)
      throw new Error('integrity_mismatch');
    if (record.remaining <= 0) throw new Error('quota_exceeded');
    record.remaining--;
    engineCalls++;
    const output = calculate(input);
    try {
      preparedSurface.manifest.validateOutput(
        appSurface.action.id,
        new JsonDocument(JSON.stringify(output)),
      );
    } catch {
      throw new Error('invalid_result');
    }
    const appSpanId = randomBytes(8).toString('hex');
    const timestamp = new Date(currentTime).toISOString();
    const receiptContext: ReceiptContext & { issuerId: string; now: string } = {
      grant_id: record.grant.grant_id,
      grant_hash: record.grant.grant_hash,
      session_id: record.session.session_id,
      session_generation: record.session.session_generation,
      trace_id: payload.trace_id as string,
      span_id: appSpanId,
      action_id: appSurface.action.id,
      app_id: configuredAppId,
      surface_version: appSurface.surface_version,
      surface_hash: appSurface.surface_hash,
      runtime_id: record.binding.delegate.runtime,
      agent_id: record.binding.delegate.agent,
      identity_evidence_hash: record.binding.identity_evidence_hash,
      user: record.binding.subject.user,
      idempotency_key: payload.idempotency_key as string,
      input_hash: inputHash,
      execution: {
        mode: 'propose',
        execution_id: execution.execution_id as string,
      },
      execution_hash: executionHash,
      issuerId: configuredAppId,
      now: timestamp,
    };
    const appReceipt = createApplicationReceipt(
      receiptContext,
      runtimeReceipt.receipt_hash,
      canonicalHash(
        'https://github.com/0al-spec/agent-surface/hash/action-output/v1',
        output,
      ),
    );
    return serializeCalculationResponse({
      type: 'action.result',
      payload: {
        ...expectedBinding,
        action_id: 'calculation.propose',
        trace_id: payload.trace_id,
        span_id: payload.span_id,
        idempotency_key: payload.idempotency_key,
        parent_receipt_hash: payload.parent_receipt_hash,
        input_hash: inputHash,
        execution,
        execution_hash: executionHash,
        result: 'success',
        output,
        receipt: appReceipt,
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

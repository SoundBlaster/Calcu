import {
  CanonicalObjectHash,
  JsonDocument,
  OfflineProposalManifest,
  type OfflineSchemaResource,
  OfflineSchemaResources,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import { calculationDataClasses, calculationDataExposure } from './exposure';
import {
  TEST_FRESHNESS_PROFILE,
  TEST_KEY_BINDING_PROFILE,
  TEST_STATUS_PROFILE,
  TEST_VERIFICATION_PROFILE,
} from './identity';

const ASP = 'https://github.com/0al-spec/agent-surface/';
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const INPUT_SCHEMA_HASH_DOMAIN = `${ASP}hash/action-input-schema/v1`;
const IDENTITY_PROFILE = `${ASP}profiles/agent-identity-evidence/v1`;
const FORMAT_PROFILE = `${ASP}profiles/agent-passport-minimal/v1`;
const DIGEST_PROFILE = `${ASP}hash/agent-passport-artifact/v1`;

export const RECEIPT_REQUIRED_FIELDS = Object.freeze([
  'receipt_id',
  'receipt_type',
  'receipt_hash',
  'grant_id',
  'grant_hash',
  'session_id',
  'session_generation',
  'trace_id',
  'span_id',
  'action_id',
  'app_id',
  'surface_version',
  'surface_hash',
  'runtime',
  'actor_agent',
  'subject',
  'idempotency_key',
  'input_hash',
  'execution',
  'execution_hash',
  'policy_decision',
  'policy_decision_hash',
  'timestamp',
  'result',
]);

export type CalcuSurface = {
  /** Fixed action endpoint retained under the prior local API name. */
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

export type PreparedCalcuSurface = {
  readonly surface: CalcuSurface;
  readonly document: JsonDocument;
  readonly identityAdvertisement: JsonDocument;
  /** Prepared schema inputs, exposed for offline composition comparisons. */
  readonly schemaResources: readonly OfflineSchemaResource[];
  readonly manifest: ReturnType<OfflineProposalManifest['prepare']>;
};

function json(value: unknown) {
  return new JsonDocument(JSON.stringify(value));
}

function schemaResource(uri: string, schema: Record<string, unknown>) {
  return {
    uri,
    document: json({ $schema: DIALECT, $id: uri, ...schema }),
  } satisfies OfflineSchemaResource;
}

export function prepareCalcuSurface(
  appId = 'calcu.local',
  issuer = 'https://calcu.local',
): PreparedCalcuSurface {
  const actionId = 'calculation.propose';
  const scopeId = actionId;
  const actionUrl = `${issuer}/agent-actions`;
  const inputUri = `${issuer}/schemas/${actionId}.input.json`;
  const outputUri = `${issuer}/schemas/${actionId}.output.json`;
  const eventUri = `${issuer}/schemas/grant-revoked.event.json`;
  const receiptUri = `${issuer}/schemas/action-receipt.json`;
  const identityAdvertisementValue = {
    profile: IDENTITY_PROFILE,
    format_profile: FORMAT_PROFILE,
    artifact_digest_profile: DIGEST_PROFILE,
    verification_profiles: [TEST_VERIFICATION_PROFILE],
    key_binding_profiles: [TEST_KEY_BINDING_PROFILE],
    freshness_profiles: [TEST_FRESHNESS_PROFILE],
    status_profiles: [TEST_STATUS_PROFILE],
    migration_profiles: [],
    max_artifact_bytes: 262_144,
  };
  const identityAdvertisement = json(identityAdvertisementValue);
  const input = schemaResource(inputUri, {
    type: 'object',
    properties: {
      operator: { enum: ['add', 'subtract', 'multiply', 'divide'] },
      left: { type: 'number' },
      right: { type: 'number' },
    },
    required: ['operator', 'left', 'right'],
    additionalProperties: false,
  });
  const output = schemaResource(outputUri, {
    type: 'object',
    properties: {
      operator: { enum: ['add', 'subtract', 'multiply', 'divide'] },
      left: { type: 'number' },
      right: { type: 'number' },
      result: { type: 'number' },
    },
    required: ['operator', 'left', 'right', 'result'],
    additionalProperties: false,
  });
  const resources: OfflineSchemaResource[] = [
    input,
    output,
    schemaResource(eventUri, { type: 'object' }),
    schemaResource(receiptUri, {
      type: 'object',
      required: RECEIPT_REQUIRED_FIELDS,
      properties: {
        receipt_id: { type: 'string' },
        receipt_type: { enum: ['runtime', 'app'] },
        receipt_hash: { type: 'string' },
        parent_receipt_hash: { type: 'string' },
        grant_id: { type: 'string' },
        grant_hash: { type: 'string' },
        session_id: { type: 'string' },
        session_generation: { type: 'integer', minimum: 1 },
        trace_id: { type: 'string' },
        span_id: { type: 'string' },
        action_id: { type: 'string' },
        app_id: { type: 'string' },
        surface_version: { type: 'string' },
        surface_hash: { type: 'string' },
        runtime: {
          type: 'object',
          properties: { runtime_id: { type: 'string' } },
          required: ['runtime_id'],
          additionalProperties: false,
        },
        actor_agent: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            identity_evidence_hash: { type: 'string' },
          },
          required: ['agent_id', 'identity_evidence_hash'],
          additionalProperties: false,
        },
        subject: {
          type: 'object',
          properties: { user: { type: 'string' } },
          required: ['user'],
          additionalProperties: false,
        },
        idempotency_key: { type: 'string' },
        input_hash: { type: 'string' },
        execution: {
          type: 'object',
          properties: {
            mode: { const: 'propose' },
            execution_id: { type: 'string' },
          },
          required: ['mode', 'execution_id'],
          additionalProperties: false,
        },
        execution_hash: { type: 'string' },
        output_hash: { type: 'string' },
        policy_decision: {
          type: 'object',
          properties: {
            type: { const: 'policy.decision' },
            decision_id: { type: 'string' },
            enforcer: {
              type: 'object',
              properties: {
                type: { enum: ['runtime', 'application'] },
                id: { type: 'string' },
              },
              required: ['type', 'id'],
              additionalProperties: false,
            },
            outcome: { const: 'allow' },
            policy: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                version: { type: 'string' },
              },
              required: ['id', 'version'],
              additionalProperties: false,
            },
            reason_code: { type: 'string' },
            matched_rules: { type: 'array', items: { type: 'string' } },
            safe_to_show: { type: 'string' },
            evaluated_at: { type: 'string' },
            policy_decision_hash: { type: 'string' },
          },
          required: [
            'type',
            'decision_id',
            'enforcer',
            'outcome',
            'policy',
            'reason_code',
            'matched_rules',
            'safe_to_show',
            'evaluated_at',
            'policy_decision_hash',
          ],
          additionalProperties: false,
        },
        policy_decision_hash: { type: 'string' },
        timestamp: { type: 'string' },
        result: { enum: ['authorized_for_forwarding', 'success'] },
      },
      additionalProperties: false,
    }),
  ];
  const actionExposure = calculationDataExposure();
  const controlExposure = {
    classes: [],
    redaction: { mode: 'none' },
    retention: { mode: 'transient', delete_on_grant_end: true },
  };
  const manifest = {
    protocol: 'agent-surface/0.1',
    app_id: appId,
    issuer,
    surface_mode: 'proposal_only',
    surface_version: '0.1.1',
    surface_url: `${issuer}/.well-known/agent-surface.json`,
    compatibility: {
      min_runtime: 'application-runtime/0.1',
      schema_dialect: DIALECT,
      agent_identity_evidence_profiles: [identityAdvertisementValue],
    },
    auth: {
      type: `${ASP}profiles/host-provisioned-bearer/v1`,
      credential_profile: 'compatibility_bearer',
    },
    agent_api: {
      credential_audience: `${issuer}/agent-api`,
      grant_introspection_url: `${issuer}/agent-grants/introspect`,
      grant_revocation_url: `${issuer}/agent-grants/revoke`,
      action_url: actionUrl,
      session_control_url: `${issuer}/agent-sessions/control`,
      event_subscription_url: `${issuer}/agent-events`,
      event_delivery: {
        profile: 'at_least_once',
        ack_deadline_seconds: 30,
        max_in_flight: 8,
        retention_seconds: 300,
      },
    },
    scopes: [{ id: scopeId, description: 'Prepare an application proposal.' }],
    data_classes: calculationDataClasses(),
    resources: [],
    actions: [
      {
        id: actionId,
        scope: scopeId,
        risk: 'propose',
        side_effect: false,
        approval: 'none',
        execution: {
          mode: 'propose',
          operation_id: `${actionId}.operation`,
          persisted: false,
        },
        input_schema: inputUri,
        input_schema_hash: new CanonicalObjectHash(
          INPUT_SCHEMA_HASH_DOMAIN,
        ).digest(input.document),
        output_schema: outputUri,
        data_exposure: actionExposure,
      },
    ],
    events: [
      {
        id: 'grant.revoked',
        control: true,
        schema: eventUri,
        data_exposure: controlExposure,
      },
    ],
    audit: {
      hash_profile: 'asp-jcs-sha-256',
      receipt_schema: receiptUri,
      required_fields: RECEIPT_REQUIRED_FIELDS,
    },
    revocation: {
      grant_management_url: `${issuer}/settings/agent-grants`,
      grant_revocation_url: `${issuer}/agent-grants/revoke`,
      event: 'grant.revoked',
    },
  };
  const snapshot = new SurfaceSnapshot(json(manifest));
  const surfaceHash = snapshot.hash();
  const document = json({ ...manifest, surface_hash: surfaceHash });
  const schemaResources = Object.freeze([...resources]);
  const prepared = new OfflineProposalManifest(
    document,
    new OfflineSchemaResources(schemaResources),
    identityAdvertisement,
  ).prepare();
  const surface: CalcuSurface = Object.freeze({
    surface_url: actionUrl,
    surface_version: manifest.surface_version,
    surface_mode: 'proposal_only',
    actions: Object.freeze([actionId]) as readonly ['calculation.propose'],
    scopes: Object.freeze([scopeId]) as readonly ['calculation.propose'],
    credential_audience: manifest.agent_api.credential_audience,
    credential_release: Object.freeze({ mode: 'deny' as const }),
    action: Object.freeze({
      id: actionId,
      execution: Object.freeze({ mode: 'propose' as const }),
      side_effect: false as const,
    }),
    surface_hash: prepared.surfaceHash,
  });
  return {
    surface,
    document,
    identityAdvertisement,
    schemaResources,
    manifest: prepared,
  };
}

export const preparedSurface = prepareCalcuSurface();
export const surface = preparedSurface.surface;

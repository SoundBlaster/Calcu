import {
  generateKeyPairSync,
  type KeyObject,
  sign,
  timingSafeEqual,
  verify,
} from 'node:crypto';
import { parseDocument } from 'yaml';
import { exact, object } from './calcu';
import { artifactHash, byteHash, canonicalHash } from './hash';

export const IDENTITY_EVIDENCE_PROFILE =
  'https://github.com/0al-spec/agent-surface/profiles/agent-identity-evidence/v1';
export const PASSPORT_FORMAT_PROFILE =
  'https://github.com/0al-spec/agent-surface/profiles/agent-passport-minimal/v1';
export const PASSPORT_ARTIFACT_DIGEST_PROFILE =
  'https://github.com/0al-spec/agent-surface/hash/agent-passport-artifact/v1';
export const TEST_VERIFICATION_PROFILE =
  'https://calcu.local/profiles/agent-passport-ed25519-test/v1';
export const TEST_KEY_BINDING_PROFILE =
  'https://calcu.local/profiles/ed25519-spki-sha256-test/v1';
export const TEST_FRESHNESS_PROFILE =
  'https://calcu.local/profiles/status-max-age-test/v1';
export const TEST_STATUS_PROFILE =
  'https://calcu.local/profiles/agent-status-test/v1';

const IDENTITY_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/agent-identity-evidence/v1';

export type IdentityEvidence = {
  profile: string;
  format_profile: string;
  artifact_ref?: string;
  artifact_digest: { profile: string; value: string };
  issuer: string;
  subject: string;
  verification_profile: string;
  key_binding: { profile: string; value: string };
  lifecycle: {
    freshness_profile: string;
    status_profile: string;
    status_ref: string;
  };
};

export type IdentityInput = {
  evidence: unknown;
  artifactBytes: Uint8Array;
};

export type VerifiedIdentity = {
  evidence: IdentityEvidence;
  identity_evidence_hash: string;
  agent_uid: string;
  status_valid_until: number;
};

export type IdentityEvidenceVerifier = {
  verify(input: IdentityInput, now: number): VerifiedIdentity;
};

export type TestIdentityStatus =
  | 'active'
  | 'revoked'
  | 'expired'
  | 'unknown'
  | 'unavailable';

type TestStatusRecord = { state: TestIdentityStatus; validUntil: number };

function equalText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeYamlNode(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  const value = node as {
    constructor?: { name?: string };
    tag?: string;
    items?: unknown[];
    key?: unknown;
    value?: unknown;
  };
  if (value.constructor?.name === 'Alias' || value.tag)
    throw new Error('identity_evidence_invalid');
  if (Array.isArray(value.items)) {
    for (const item of value.items) safeYamlNode(item);
  }
  if ('key' in value) safeYamlNode(value.key);
  if ('value' in value) safeYamlNode(value.value);
}

function verifyPassportArtifact(
  artifactBytes: Uint8Array,
  evidence: IdentityEvidence,
  publicKeys: Map<string, KeyObject>,
  now: number,
) {
  if (artifactBytes.byteLength > 262_144)
    throw new Error('identity_evidence_invalid');
  const source = Buffer.from(artifactBytes).toString('utf8');
  if (Buffer.from(source, 'utf8').compare(Buffer.from(artifactBytes)) !== 0)
    throw new Error('identity_evidence_invalid');
  const document = parseDocument(source, { schema: 'core', uniqueKeys: true });
  if (document.errors.length || !document.contents)
    throw new Error('identity_evidence_invalid');
  safeYamlNode(document.contents);
  const root = object(document.toJS({ maxAliasCount: 0 }));
  const passport = exact(root.passport, [
    'apiVersion',
    'kind',
    'metadata',
    'spec',
    'signature',
  ]);
  if (
    passport.apiVersion !== 'agent-passport.io/v1alpha1' ||
    passport.kind !== 'AgentPassport'
  )
    throw new Error('identity_evidence_invalid');
  const metadata = exact(passport.metadata, [
    'name',
    'uid',
    'version',
    'issueDate',
    'expiryDate',
    'issuer',
  ]);
  const spec = object(passport.spec);
  const entity = object(spec.entity);
  if (typeof entity.type !== 'string' || !entity.type)
    throw new Error('identity_evidence_invalid');
  if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0)
    throw new Error('identity_evidence_invalid');
  const names = spec.capabilities.map((entry) => {
    const capability = object(entry);
    if (typeof capability.name !== 'string' || !capability.name)
      throw new Error('identity_evidence_invalid');
    return capability.name;
  });
  if (new Set(names).size !== names.length)
    throw new Error('identity_evidence_invalid');
  const signature = exact(passport.signature, [
    'algorithm',
    'value',
    'publicKeyRef',
  ]);
  if (
    signature.algorithm !== 'Ed25519' ||
    typeof signature.value !== 'string' ||
    !signature.value
  )
    throw new Error('identity_evidence_invalid');
  const publicKeyRef = String(signature.publicKeyRef);
  const publicKey = publicKeys.get(publicKeyRef);
  if (!publicKey) throw new Error('identity_evidence_profile_unsupported');
  const signatureMatch = source.match(/^(\s+value:\s*)([^\s]+)(\s*)$/m);
  if (!signatureMatch || signatureMatch[2] !== signature.value)
    throw new Error('identity_evidence_invalid');
  const markerOffset = (signatureMatch.index ?? 0) + signatureMatch[1].length;
  const unsigned = Buffer.from(
    `${source.slice(0, markerOffset)}PLACEHOLDER${source.slice(markerOffset + signature.value.length)}`,
    'utf8',
  );
  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature.value, 'base64url');
  } catch {
    throw new Error('identity_evidence_invalid');
  }
  if (!verify(null, unsigned, publicKey, signatureBytes))
    throw new Error('identity_evidence_invalid');
  const issueDate = Date.parse(String(metadata.issueDate));
  const expiryDate = Date.parse(String(metadata.expiryDate));
  if (
    !Number.isFinite(issueDate) ||
    !Number.isFinite(expiryDate) ||
    issueDate >= expiryDate ||
    now < issueDate ||
    now >= expiryDate
  )
    throw new Error('identity_evidence_invalid');
  if (
    !equalText(String(metadata.issuer), evidence.issuer) ||
    !equalText(String(metadata.uid), evidence.subject)
  )
    throw new Error('identity_evidence_invalid');
  return { uid: String(metadata.uid), expiryDate, publicKey, publicKeyRef };
}

export function createTestIdentityFixture(now = Date.now()) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyRef = 'test://calcu-agent-key';
  const unsigned = `passport:\n  apiVersion: agent-passport.io/v1alpha1\n  kind: AgentPassport\n  metadata:\n    name: calcu-test-agent\n    uid: calcu-agent-uid\n    version: 1.0.0\n    issueDate: 2026-01-01T00:00:00Z\n    expiryDate: 2099-01-01T00:00:00Z\n    issuer: https://calcu.test/issuer\n  spec:\n    entity:\n      type: agent\n    capabilities:\n      - name: calculation.propose\n        signature:\n          parameters: object\n          returns: object\n  signature:\n    algorithm: Ed25519\n    value: PLACEHOLDER\n    publicKeyRef: ${publicKeyRef}\n`;
  const signature = sign(
    null,
    Buffer.from(unsigned, 'utf8'),
    privateKey,
  ).toString('base64url');
  const artifactBytes = Buffer.from(
    unsigned.replace('PLACEHOLDER', signature),
    'utf8',
  );
  const statusRef = 'calcu-test-agent-status';
  const evidence: IdentityEvidence = {
    profile: IDENTITY_EVIDENCE_PROFILE,
    format_profile: PASSPORT_FORMAT_PROFILE,
    artifact_ref: 'memory://calcu-test-agent-passport',
    artifact_digest: {
      profile: PASSPORT_ARTIFACT_DIGEST_PROFILE,
      value: artifactHash(artifactBytes),
    },
    issuer: 'https://calcu.test/issuer',
    subject: 'calcu-agent-uid',
    verification_profile: TEST_VERIFICATION_PROFILE,
    key_binding: {
      profile: TEST_KEY_BINDING_PROFILE,
      value: byteHash(
        'calcu ed25519 spki sha-256 test v1',
        publicKey.export({ type: 'spki', format: 'der' }),
      ),
    },
    lifecycle: {
      freshness_profile: TEST_FRESHNESS_PROFILE,
      status_profile: TEST_STATUS_PROFILE,
      status_ref: statusRef,
    },
  };
  let status: TestStatusRecord = { state: 'active', validUntil: now + 300_000 };
  return {
    evidence,
    artifactBytes,
    publicKeyRef,
    publicKey,
    setStatus(next: TestIdentityStatus, validUntil = now + 300_000) {
      status = { state: next, validUntil };
    },
    get status() {
      return status;
    },
  };
}

export function createTestIdentityVerifier(
  fixture: ReturnType<typeof createTestIdentityFixture>,
): IdentityEvidenceVerifier {
  return {
    verify(input, now) {
      const evidence = object(input.evidence);
      const keys = Object.keys(evidence).sort();
      const required = [
        'artifact_digest',
        'format_profile',
        'issuer',
        'key_binding',
        'lifecycle',
        'profile',
        'subject',
        'verification_profile',
      ];
      const withRef = [...required, 'artifact_ref'].sort();
      if (
        JSON.stringify(keys) !== JSON.stringify(required) &&
        JSON.stringify(keys) !== JSON.stringify(withRef)
      )
        throw new Error('identity_evidence_invalid');
      const parsed: IdentityEvidence = {
        ...evidence,
        artifact_digest: exact(evidence.artifact_digest, [
          'profile',
          'value',
        ]) as IdentityEvidence['artifact_digest'],
        key_binding: exact(evidence.key_binding, [
          'profile',
          'value',
        ]) as IdentityEvidence['key_binding'],
        lifecycle: exact(evidence.lifecycle, [
          'freshness_profile',
          'status_profile',
          'status_ref',
        ]) as IdentityEvidence['lifecycle'],
      } as IdentityEvidence;
      if (
        parsed.profile !== IDENTITY_EVIDENCE_PROFILE ||
        parsed.format_profile !== PASSPORT_FORMAT_PROFILE ||
        parsed.artifact_digest.profile !== PASSPORT_ARTIFACT_DIGEST_PROFILE ||
        parsed.verification_profile !== TEST_VERIFICATION_PROFILE ||
        parsed.key_binding.profile !== TEST_KEY_BINDING_PROFILE ||
        parsed.lifecycle.freshness_profile !== TEST_FRESHNESS_PROFILE ||
        parsed.lifecycle.status_profile !== TEST_STATUS_PROFILE ||
        parsed.lifecycle.status_ref !== fixture.evidence.lifecycle.status_ref
      )
        throw new Error('identity_evidence_profile_unsupported');
      const digest = artifactHash(input.artifactBytes);
      if (!equalText(digest, parsed.artifact_digest.value))
        throw new Error('identity_evidence_invalid');
      const passport = verifyPassportArtifact(
        input.artifactBytes,
        parsed,
        new Map([[fixture.publicKeyRef, fixture.publicKey]]),
        now,
      );
      const keyBinding = byteHash(
        'calcu ed25519 spki sha-256 test v1',
        passport.publicKey.export({ type: 'spki', format: 'der' }),
      );
      if (!equalText(keyBinding, parsed.key_binding.value))
        throw new Error('identity_evidence_invalid');
      const current = fixture.status;
      if (current.state !== 'active')
        throw new Error(`identity_evidence_${current.state}`);
      if (
        !Number.isFinite(current.validUntil) ||
        current.validUntil <= now ||
        current.validUntil > passport.expiryDate
      )
        throw new Error('identity_evidence_expired');
      return {
        evidence: parsed,
        identity_evidence_hash: canonicalHash(IDENTITY_HASH_DOMAIN, parsed),
        agent_uid: passport.uid,
        status_valid_until: current.validUntil,
      };
    },
  };
}

// The local demo uses the same ephemeral trust mechanism as conformance tests,
// but these aliases make its development-only role explicit. Neither function
// represents production identity infrastructure or Codex binary attestation.
export function createEphemeralDevelopmentIdentity(now = Date.now()) {
  const fixture = createTestIdentityFixture(now);
  fixture.setStatus('active', now + 24 * 60 * 60 * 1_000);
  return fixture;
}

export function createDevelopmentIdentityVerifier(
  fixture: ReturnType<typeof createEphemeralDevelopmentIdentity>,
) {
  return createTestIdentityVerifier(fixture);
}

import { createHash } from 'node:crypto';
import { CanonicalObjectHash, JsonDocument } from '@0al/agent-surface';
import canonicalize from 'canonicalize';

function rejectNegativeZero(value: unknown): void {
  if (typeof value === 'number') {
    if (Object.is(value, -0)) throw new Error('schema_invalid');
    return;
  }
  if (Array.isArray(value)) {
    for (const member of value) rejectNegativeZero(member);
    return;
  }
  if (value && typeof value === 'object') {
    for (const member of Object.values(value)) rejectNegativeZero(member);
  }
}

// Callers supply internally constructed/validated JSON values, not raw wire
// text. Retain the existing JCS value serializer (including non-finite rejection)
// while the SDK owns the ASP wrapper, domain separation and digest encoding.
export function canonicalHash(domain: string, value: unknown) {
  rejectNegativeZero(value);
  const serialized = canonicalize(value);
  if (!serialized) throw new Error('schema_invalid');
  return new CanonicalObjectHash(domain).digest(new JsonDocument(serialized));
}

export function byteHash(domain: string, bytes: Uint8Array) {
  return `sha-256:${createHash('sha256')
    .update(`${domain}\0`, 'utf8')
    .update(Buffer.from(bytes))
    .digest('base64url')}`;
}

export function artifactHash(bytes: Uint8Array) {
  return byteHash('ASP agent-passport artifact v1', bytes);
}

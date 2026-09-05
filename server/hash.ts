import { createHash } from 'node:crypto';
import { CanonicalObjectHash, JsonDocument } from '@0al/agent-surface';
import canonicalize from 'canonicalize';

// Callers supply internally constructed/validated JSON values, not raw wire
// text. Retain the existing JCS value serializer (including non-finite rejection)
// while the SDK owns the ASP wrapper, domain separation and digest encoding.
export function canonicalHash(domain: string, value: unknown) {
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

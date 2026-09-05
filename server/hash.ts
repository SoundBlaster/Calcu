import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

export function canonicalHash(domain: string, value: unknown) {
  const serialized = canonicalize({ domain, object: value });
  if (!serialized) throw new Error('schema_invalid');
  return `sha-256:${createHash('sha256')
    .update(serialized, 'utf8')
    .digest('base64url')}`;
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

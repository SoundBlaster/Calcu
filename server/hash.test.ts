// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JsonDocument, SurfaceSnapshot } from '@0al/agent-surface';
import canonicalize from 'canonicalize';
import { describe, expect, it } from 'vitest';
import { surface } from './executor';
import { artifactHash, byteHash, canonicalHash } from './hash';

describe('ASP hash profiles', () => {
  it('matches an independent identity-evidence domain vector', () => {
    // Synthetic hashing vector, not valid identity authority or an artifact.
    const evidence = {
      artifact_digest: {
        profile:
          'https://github.com/0al-spec/agent-surface/hash/agent-passport-artifact/v1',
        value: 'sha-256:FIXED',
      },
      artifact_ref: 'memory://calcu-test-agent-passport',
      format_profile:
        'https://github.com/0al-spec/agent-surface/profiles/agent-passport-minimal/v1',
      issuer: 'https://calcu.test/issuer',
      key_binding: {
        profile: 'https://calcu.local/profiles/ed25519-spki-sha256-test/v1',
        value: 'sha-256:FIXED',
      },
      lifecycle: {
        freshness_profile:
          'https://calcu.local/profiles/status-max-age-test/v1',
        status_profile: 'https://calcu.local/profiles/agent-status-test/v1',
        status_ref: 'calcu-test-agent-status',
      },
      profile:
        'https://github.com/0al-spec/agent-surface/profiles/agent-identity-evidence/v1',
      subject: 'calcu-agent-uid',
      verification_profile:
        'https://calcu.local/profiles/agent-passport-ed25519-test/v1',
    };
    const digest = canonicalHash(
      'https://github.com/0al-spec/agent-surface/hash/agent-identity-evidence/v1',
      evidence,
    );
    expect(digest).toBe('sha-256:aRqGoyRPnUKqvZxtxtT_ejhyRr3tFYfGKRXevNV_B_M');
    const oldDomainDigest = canonicalHash(
      'https://github.com/0al-spec/agent-surface/hash/identity-evidence/v1',
      evidence,
    );
    expect(oldDomainDigest).toBe(
      'sha-256:3SMiYi5Dc3AL3JL6wezq2F7e0gWK2DnR3zpK6eYJJDM',
    );
    expect(digest).not.toBe(oldDomainDigest);
  });

  it('uses the RFC 8785 wrapper and preserves the ASP domain', () => {
    expect(
      canonicalHash('https://github.com/0al-spec/agent-surface/hash/grant/v1', {
        b: 1,
        a: 2,
      }),
    ).toBe('sha-256:Q2gjSTSPZ1b5gMFs3zIAtpqO0RHMt90sIy3TpjqFBkY');
  });

  it('matches the ASP exact Agent Passport artifact vector', () => {
    expect(artifactHash(Buffer.from('passport: {}\n', 'utf8'))).toBe(
      'sha-256:218YMarWJ5KKssblgnAdgryNm_8JGmVt4sAkYPeq9Mk',
    );
  });

  it.each([
    'manifest',
    'grant',
    'agent-identity-evidence',
  ])('preserves the previous %s wrapper for supported JSON values', (profile) => {
    const domain = `https://github.com/0al-spec/agent-surface/hash/${profile}/v1`;
    for (const value of [
      { b: 1, a: 2 },
      { nested: { z: null, a: ['é', 'e\u0301', '😀', true, false] } },
      { tiny: 1e-7, large: 1e21, fraction: 0.15, zero: -0 },
      { extension: { surface_hash: 'nested-member-retained' } },
    ]) {
      const original = structuredClone(value);
      // Characterization oracle: the pre-SDK wrapper and digest, not SDK code.
      const legacy = `sha-256:${createHash('sha256')
        .update(canonicalize({ domain, object: value }) as string, 'utf8')
        .digest('base64url')}`;
      expect(canonicalHash(domain, value)).toBe(legacy);
      expect(value).toEqual(original);
    }
  });

  it('agrees with the SDK manifest view for the existing Calcu surface', () => {
    expect(
      new SurfaceSnapshot(new JsonDocument(JSON.stringify(surface))).hash(),
    ).toBe(surface.surface_hash);
  });

  it('preserves member-order invariance but not array or domain equivalence', () => {
    expect(canonicalHash('a', { a: 1, b: 2 })).toBe(
      canonicalHash('a', { b: 2, a: 1 }),
    );
    expect(canonicalHash('a', [1, 2])).not.toBe(canonicalHash('a', [2, 1]));
    expect(canonicalHash('a', { a: 1 })).not.toBe(canonicalHash('b', { a: 1 }));
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('still rejects non-finite values instead of serializing %s to null', (invalid) => {
    expect(() => canonicalHash('test', { nested: [invalid] })).toThrow();
  });

  it('preserves rejection of lone surrogates before hashing', () => {
    expect(() => canonicalHash('test', { text: '\ud800' })).toThrow();
    expect(() =>
      canonicalize({ domain: 'test', object: { text: '\ud800' } }),
    ).toThrow();
  });

  it('keeps credential byte hashing separate from the JCS wrapper', () => {
    const domain = 'calcu compatibility bearer credential v1';
    const bytes = Buffer.from('fixture-only');
    const expected = `sha-256:${createHash('sha256')
      .update(`${domain}\0`, 'utf8')
      .update(bytes)
      .digest('base64url')}`;
    expect(byteHash(domain, bytes)).toBe(expected);
    expect(byteHash(domain, bytes)).not.toBe(
      canonicalHash(domain, 'fixture-only'),
    );
  });

  it('pins the installed SDK package artifact and ASP evidence revision', () => {
    const tarball = readFileSync(
      new URL(
        '../vendor/0al-agent-surface-0.1.0-experimental.0.tgz',
        import.meta.url,
      ),
    );
    const lock = JSON.parse(
      readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
    );
    expect(lock.packages['node_modules/@0al/agent-surface'].integrity).toBe(
      `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
    );
    const sdkLock = JSON.parse(
      readFileSync(
        new URL('../spec-lock.json', import.meta.resolve('@0al/agent-surface')),
        'utf8',
      ),
    );
    expect(sdkLock.commit).toBe('951871c2d55db25d35512f29cc0970c69aa5cfd9');
    expect(sdkLock.sources).toEqual([
      {
        path: 'drafts/modules/evidence.md',
        sha256:
          '594d71c3972b350dbe21fea6078d301fbbc817470ab3feb07a95bd695ae0b86f',
      },
    ]);
  });
});

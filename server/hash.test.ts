// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { artifactHash, canonicalHash } from './hash';

describe('ASP hash profiles', () => {
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
});

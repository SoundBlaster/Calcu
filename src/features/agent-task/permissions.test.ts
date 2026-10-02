import { describe, expect, it } from 'vitest';
import { readPermissionOffer } from './permissions';

function offer() {
  return {
    offer_id: 'a'.repeat(64),
    expires_at: Date.now() + 60_000,
    action_id: 'calculation.propose',
    surface_version: 'opaque-draft/next',
    retention: 'user_managed',
    data_classes: [
      {
        id: 'calculation.content',
        label: 'Calculation content',
        classification: 'sensitive',
      },
      {
        id: 'calculation.runtime_context',
        label: 'Runtime context',
        classification: 'sensitive',
      },
      {
        id: 'calculation.status',
        label: 'Calculation status',
        classification: 'private',
      },
    ],
  };
}

describe('public permission offer metadata', () => {
  it('accepts a bounded opaque server version without assuming a numeric ordering', () => {
    expect(readPermissionOffer(offer()).surface_version).toBe(
      'opaque-draft/next',
    );
  });

  it.each([
    undefined,
    null,
    12,
    '',
    ' ',
    'x'.repeat(129),
    'version\nnext',
  ])('rejects invalid or missing version %s', (value) => {
    const record: Record<string, unknown> = offer();
    if (value === undefined) delete record.surface_version;
    else record.surface_version = value;
    expect(() => readPermissionOffer(record)).toThrow('permission_invalid');
  });

  it.each([
    'credential',
    'grant',
    'passport',
    'identity_evidence',
    'receipt',
    'surface_hash',
  ])('rejects extra %s fields rather than treating them as display metadata', (key) => {
    expect(() =>
      readPermissionOffer({ ...offer(), [key]: 'not-public' }),
    ).toThrow('permission_invalid');
  });
});

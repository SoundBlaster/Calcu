// @vitest-environment node
import {
  JsonDocument,
  OfflineSelectedGrant,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import { describe, expect, it, vi } from 'vitest';
import { createCalcuExecutor } from './executor';
import {
  calculationResponseCoverage,
  serializeCalculationResponse,
} from './exposure';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
} from './identity';
import { createLocalBackend } from './localBackend';
import { prepareCalcuSurface } from './manifest';

const now = Date.parse('2026-09-05T00:00:00Z');
async function roundTrip() {
  const identity = createTestIdentityFixture(now);
  const app = createCalcuExecutor({
    now: () => now,
    identityVerifier: createTestIdentityVerifier(identity),
  });
  const surface = prepareCalcuSurface();
  const access = app.issue({
    subject: { user: 'calcu-user-local' },
    delegate: {
      runtime: 'calcu-runtime-local',
      agent: identity.evidence.subject,
    },
    identity: {
      evidence: identity.evidence,
      artifactBytes: identity.artifactBytes,
    },
    audience: surface.surface.credential_audience,
    expires_at: now + 60_000,
  });
  let response = '';
  let request = '';
  const backend = createLocalBackend(
    access,
    async (credential, body) => {
      request = body;
      response = await app.invoke(credential, body);
      return response;
    },
    () => now,
  );
  const result = await backend.calculationPropose({
    operator: 'multiply',
    left: 240,
    right: 0.15,
  });
  return {
    app,
    access,
    result,
    response: JSON.parse(response),
    request: JSON.parse(request),
  };
}

describe('application-owned Calcu exposure policy', () => {
  it('binds the data classification itself into the canonical surface hash', () => {
    const prepared = prepareCalcuSurface();
    const value = prepared.document.parse() as Record<string, unknown>;
    delete value.surface_hash;
    const original = new SurfaceSnapshot(
      new JsonDocument(JSON.stringify(value)),
    ).hash();
    expect(original).toBe(prepared.surface.surface_hash);
    const classes = value.data_classes as { classification: string }[];
    classes[0].classification = 'private';
    expect(
      new SurfaceSnapshot(new JsonDocument(JSON.stringify(value))).hash(),
    ).not.toBe(original);
  });
  it('derives the exact action and control source closure in the issued Grant', async () => {
    const spy = vi.spyOn(OfflineSelectedGrant.prototype, 'prepare');
    try {
      await roundTrip();
      const prepared = spy.mock.results[0];
      expect(prepared.type).toBe('return');
      expect(prepared.value.dataExposure().parse()).toEqual([
        {
          source: { kind: 'action', id: 'calculation.propose' },
          classes: [
            'calculation.content',
            'calculation.runtime_context',
            'calculation.status',
          ],
          redaction: { mode: 'none' },
          retention: { mode: 'user_managed' },
        },
        {
          source: { kind: 'event', id: 'grant.revoked' },
          classes: [],
          redaction: { mode: 'none' },
          retention: { mode: 'transient', delete_on_grant_end: true },
        },
      ]);
    } finally {
      spy.mockRestore();
    }
  });
  it('declares content and runtime context as sensitive, without a retention promise', () => {
    const value = prepareCalcuSurface().document.parse() as {
      surface_version: string;
      data_classes: { id: string; classification: string }[];
      actions: { data_exposure: unknown }[];
      events: { data_exposure: unknown }[];
    };
    expect(value.surface_version).toBe('0.1.3');
    expect(
      value.data_classes.map(({ id, classification }) => [id, classification]),
    ).toEqual([
      ['calculation.content', 'sensitive'],
      ['calculation.runtime_context', 'sensitive'],
      ['calculation.status', 'private'],
    ]);
    expect(value.actions[0].data_exposure).toEqual({
      classes: [
        'calculation.content',
        'calculation.runtime_context',
        'calculation.status',
      ],
      redaction: { mode: 'none' },
      retention: { mode: 'user_managed' },
    });
    expect(value.events[0].data_exposure).toEqual({
      classes: [],
      redaction: { mode: 'none' },
      retention: { mode: 'transient', delete_on_grant_end: true },
    });
  });

  it('covers the entire actual runtime envelope, not just the model-facing result', async () => {
    const fixture = await roundTrip();
    expect(fixture.result.result).toBe(36);
    const coverage = calculationResponseCoverage(fixture.response);
    expect(coverage['/payload/output/left']).toBe('calculation.content');
    expect(coverage['/payload/output/right']).toBe('calculation.content');
    expect(coverage['/payload/output/result']).toBe('calculation.content');
    expect(coverage['/payload/subject/user']).toBe(
      'calculation.runtime_context',
    );
    expect(coverage['/payload/receipt/policy_decision/safe_to_show']).toBe(
      'calculation.runtime_context',
    );
    expect(coverage['/payload/receipt/policy_decision/matched_rules/0']).toBe(
      'calculation.runtime_context',
    );
    expect(coverage['/payload/result']).toBe('calculation.status');
    expect(fixture.app.engineCalls).toBe(1);
  });

  it.each([
    'envelope',
    'output',
    'receipt',
    'policy',
    'array',
    'prototype',
  ])('rejects an unclassified %s field before serialization, without echoing its value', async (kind) => {
    const { response } = await roundTrip();
    const marker = 'SECRET-UNCLASSIFIED';
    if (kind === 'envelope') response.extra = marker;
    if (kind === 'output') response.payload.output.extra = marker;
    if (kind === 'receipt') response.payload.receipt.extra = marker;
    if (kind === 'policy')
      response.payload.receipt.policy_decision.safe_to_show = { extra: marker };
    if (kind === 'array')
      response.payload.receipt.policy_decision.matched_rules.push({
        extra: marker,
      });
    if (kind === 'prototype')
      Object.defineProperty(response.payload, '__proto__', {
        enumerable: true,
        value: marker,
      });
    expect(() => serializeCalculationResponse(response)).toThrow(
      'data_exposure_violation',
    );
    try {
      serializeCalculationResponse(response);
    } catch (error) {
      expect(String(error)).not.toContain(marker);
    }
  });

  it('rejects the previous surface binding before the math engine runs again', async () => {
    const { app, access, request } = await roundTrip();
    request.payload.surface_version = '0.1.0';
    const before = app.engineCalls;
    await expect(
      app.invoke(access.credential, JSON.stringify(request)),
    ).rejects.toThrow();
    expect(app.engineCalls).toBe(before);
  });
});

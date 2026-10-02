// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  CanonicalObjectHash,
  JsonDocument,
  OfflineProposalManifest,
  OfflineSchemaResources,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import canonicalize from 'canonicalize';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type CandidateInput,
  type CandidateOutput,
  prepareCalcuActionCandidate,
} from './action-authoring-candidate';
import type { Calculation, CalculationResult } from './calcu';
import { calculationDataExposure } from './exposure';
import { loadLegacyCalcuSurface } from './fixtures/legacy-surface';

const actionId = 'calculation.propose';
const inputDomain =
  'https://github.com/0al-spec/agent-surface/hash/action-input-schema/v1';
const json = (value: unknown) => new JsonDocument(JSON.stringify(value));

// Captured before the dependency switch, from Calcu f4dfe285 / prototype
// 307cbc693c98375f155d051fad2728e004749444. These are migration oracles,
// not expectations recomputed by the replacement authoring implementation.
const prototypeBaselines = [
  {
    issuer: 'https://calcu.local',
    baselineSurfaceHash: 'sha-256:JbCWzyXu_BiZqOhg_tomfvSI2MZOIyD_yVKR-DlDbaY',
    inputHash: 'sha-256:RjICwvHoNxNlNu4qIDqYyU6tZzh5_dFrsbMSrFLDBs4',
    candidateSurfaceHash: 'sha-256:nZyMGsHPo4siY2If0BAho0MRMX3C6wnKfSGcAX4iTr4',
    manifestJcsSha256:
      '7db68bbfe045777f8deb443d6840c0127abd87685ac033d89acf7d68cd7ae5ad',
    resourcesJcsSha256:
      'c789abbe8af98d2185c0af3cdb07ddcfd8276f7aede7c40fe47be49506929a3f',
  },
  {
    issuer: 'https://calcu.example.test',
    baselineSurfaceHash: 'sha-256:E4HAtpWx1TmEpgeqacO_XTAUc-AbpGZpuqR1AC0nnMc',
    inputHash: 'sha-256:6hWVDudXd9mAU-u_G3DVEAkq9OBT9Abka5XMeYPuSxE',
    candidateSurfaceHash: 'sha-256:dOD2OhTj6PSVK_s1jEy08Abygonvd-AkPC0xmQLevSk',
    manifestJcsSha256:
      '97e5ab6e86382d6e397253ef2782bd8d11d49b8fded489473049010ac3452967',
    resourcesJcsSha256:
      'b4365b50a323471fbad3a47f9133b84d2537108c1feb2bb8d686c9df035d1c96',
  },
];

function jcsDigest(value: unknown): string {
  const source = canonicalize(value);
  if (typeof source !== 'string') throw new Error('invalid_test_vector');
  return createHash('sha256').update(source).digest('hex');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('expected_object');
  return value as Record<string, unknown>;
}

describe('application-owned offline action authoring', () => {
  it('infers the existing application contract without introducing operations', () => {
    expectTypeOf<CandidateInput>().toEqualTypeOf<Calculation>();
    expectTypeOf<CandidateOutput>().toExtend<CalculationResult>();
    expectTypeOf<CalculationResult>().toExtend<CandidateOutput>();
    expectTypeOf<typeof prepareCalcuActionCandidate>().parameters.toEqualTypeOf<
      [issuer?: string]
    >();
  });
  it.each(
    prototypeBaselines,
  )('preserves the full offline candidate at $issuer without an execution handle', (golden) => {
    const { issuer } = golden;
    const generated = prepareCalcuActionCandidate(issuer);
    const baseline = loadLegacyCalcuSurface(issuer);
    const baselineValue = record(baseline.document.parse());
    const baselineAction = record((baselineValue.actions as unknown[])[0]);
    const generatedAction = record(generated.actionDocuments[0].parse());
    expect(generatedAction.data_exposure).toEqual(calculationDataExposure());
    const { input_schema_hash: oldHash, ...oldMetadata } = baselineAction;
    const { input_schema_hash: newHash, ...newMetadata } = generatedAction;
    expect(newMetadata).toEqual(oldMetadata);
    expect(generated.schemaResources).toHaveLength(2);
    expect(generated.actionDocuments).toHaveLength(1);
    expect(Object.isFrozen(generated.schemaResources)).toBe(true);
    expect(Object.isFrozen(generated)).toBe(true);
    for (const name of ['handler', 'invoke', 'run', 'issue', 'grant'])
      expect(name in generated).toBe(false);
    expect(
      jcsDigest(
        generated.schemaResources.map(({ uri, document }) => ({
          uri,
          schema: document.parse(),
        })),
      ),
    ).toBe(golden.resourcesJcsSha256);

    for (const resource of generated.schemaResources) {
      const oldResource = baseline.schemaResources.find(
        (item) => item.uri === resource.uri,
      );
      expect(oldResource).toBeDefined();
      const oldSchema = record(oldResource?.document.parse());
      const newSchema = record(resource.document.parse());
      const properties = record(newSchema.properties);
      expect(properties.operator).toEqual({
        ...record(record(oldSchema.properties).operator),
        type: 'string',
      });
      // Compare the one known redundant keyword without modifying source data.
      expect({
        ...newSchema,
        properties: {
          ...properties,
          operator: record(oldSchema.properties).operator,
        },
      }).toEqual(oldSchema);
    }
    const input = generated.schemaResources.find(
      (item) => item.uri === generatedAction.input_schema,
    );
    expect(input).toBeDefined();
    if (!input) throw new Error('missing_input');
    expect(newHash).toBe(
      new CanonicalObjectHash(inputDomain).digest(input.document),
    );
    expect(newHash).not.toBe(oldHash);
    expect(newHash).toBe(golden.inputHash);

    const untouched = baseline.schemaResources.filter(
      (item) =>
        !generated.schemaResources.some((other) => other.uri === item.uri),
    );
    const { surface_hash: oldSurfaceHash, ...withoutHash } = baselineValue;
    const candidateValue = { ...withoutHash, actions: [generatedAction] };
    const surfaceHash = new SurfaceSnapshot(json(candidateValue)).hash();
    const candidate = new OfflineProposalManifest(
      json({ ...candidateValue, surface_hash: surfaceHash }),
      new OfflineSchemaResources([...generated.schemaResources, ...untouched]),
      baseline.identityAdvertisement,
    ).prepare();
    expect(candidate.surfaceHash).toBe(surfaceHash);
    expect(surfaceHash).toBe(golden.candidateSurfaceHash);
    expect(oldSurfaceHash).toBe(golden.baselineSurfaceHash);
    expect(jcsDigest(candidate.document.parse())).toBe(
      golden.manifestJcsSha256,
    );
    expect(surfaceHash).not.toBe(oldSurfaceHash);
    const {
      actions: _actions,
      surface_hash: _hash,
      ...candidateHost
    } = record(candidate.document.parse());
    const { actions: _oldActions, ...baselineHost } = withoutHash;
    expect(candidateHost).toEqual(baselineHost);
    expect(candidateHost.scopes).toHaveLength(1);
    expect(untouched).toHaveLength(2);
    for (const operator of ['add', 'subtract', 'multiply', 'divide']) {
      const request = json({ operator, left: 240, right: 0.15 });
      candidate.validateInput(actionId, request);
      baseline.manifest.validateInput(actionId, request);
    }
    const validOutput = json({
      operator: 'multiply',
      left: 240,
      right: 0.15,
      result: 36,
    });
    candidate.validateOutput(actionId, validOutput);
    baseline.manifest.validateOutput(actionId, validOutput);
    for (const invalid of [
      { operator: 'sqrt', left: 111, right: 2 },
      { operator: 'multiply', left: '240', right: 0.15 },
      { operator: 'multiply', left: 240 },
      { operator: 'multiply', left: 240, right: 0.15, credential: 'forbidden' },
    ]) {
      expect(() => candidate.validateInput(actionId, json(invalid))).toThrow();
      expect(() =>
        baseline.manifest.validateInput(actionId, json(invalid)),
      ).toThrow();
    }
    expect(() =>
      candidate.validateOutput(
        actionId,
        json({ operator: 'multiply', left: 240, right: 0.15, result: '36' }),
      ),
    ).toThrow();
    expect(() =>
      candidate.validateInput('calculation.sqrt', json({})),
    ).toThrow();
    for (const source of [
      '{"operator":"multiply","operator":"add","left":240,"right":0.15}',
      '{"operator":"multiply","left":-0,"right":0.15}',
      '{"operator":"multiply","left":1e999,"right":0.15}',
      '{"operator":"multiply",',
    ]) {
      // Preserve the raw JSON: stringify would erase duplicate keys and -0.
      expect(() =>
        candidate.validateInput(actionId, new JsonDocument(source)),
      ).toThrow();
      expect(() =>
        baseline.manifest.validateInput(actionId, new JsonDocument(source)),
      ).toThrow();
    }
    expect(JSON.stringify(candidateValue)).not.toContain('handler');
    expect(
      prepareCalcuActionCandidate(issuer).actionDocuments[0].parse(),
    ).toEqual(generated.actionDocuments[0].parse());
  });
});

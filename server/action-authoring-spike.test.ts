// @vitest-environment node
import {
  CanonicalObjectHash,
  JsonDocument,
  OfflineProposalManifest,
  OfflineSchemaResources,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type CandidateInput,
  type CandidateOutput,
  prepareCalcuActionCandidate,
} from './action-authoring-candidate';
import { type Calculation, type CalculationResult, calculate } from './calcu';
import { calculationDataExposure } from './exposure';
import { prepareCalcuSurface } from './manifest';

const actionId = 'calculation.propose';
const inputDomain =
  'https://github.com/0al-spec/agent-surface/hash/action-input-schema/v1';
const json = (value: unknown) => new JsonDocument(JSON.stringify(value));

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
  });
  it.each([
    'https://calcu.local',
    'https://calcu.example.test',
  ])('composes the complete candidate at %s without invoking its handler', (issuer) => {
    let handlerCalls = 0;
    const generated = prepareCalcuActionCandidate((input) => {
      handlerCalls += 1;
      return calculate(input);
    }, issuer);
    const baseline = prepareCalcuSurface('calcu.local', issuer);
    const baselineValue = record(baseline.document.parse());
    const baselineAction = record((baselineValue.actions as unknown[])[0]);
    const generatedAction = record(generated.actionDocuments[0].parse());
    expect(generatedAction.data_exposure).toEqual(calculationDataExposure());
    const { input_schema_hash: oldHash, ...oldMetadata } = baselineAction;
    const { input_schema_hash: newHash, ...newMetadata } = generatedAction;
    expect(newMetadata).toEqual(oldMetadata);
    expect(generated.schemaResources).toHaveLength(2);
    expect(Object.isFrozen(generated.schemaResources)).toBe(true);

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
    expect(surfaceHash).not.toBe(oldSurfaceHash);
    const {
      actions: _actions,
      surface_hash: _hash,
      ...candidateHost
    } = record(candidate.document.parse());
    const { actions: _oldActions, ...baselineHost } = withoutHash;
    expect(candidateHost).toEqual(baselineHost);
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
    expect(handlerCalls).toBe(0);
    expect(JSON.stringify(candidateValue)).not.toContain('handler');
    expect(
      prepareCalcuActionCandidate(calculate, issuer).actionDocuments[0].parse(),
    ).toEqual(generated.actionDocuments[0].parse());
  });
});

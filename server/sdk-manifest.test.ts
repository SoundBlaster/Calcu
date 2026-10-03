// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  JsonDocument,
  OfflineProposalManifest,
  OfflineSchemaResources,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import canonicalize from 'canonicalize';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as calcu from './calcu';
import type {
  CalculationActionInput,
  CalculationActionOutput,
} from './calculation-declaration';
import { loadLegacyCalcuSurface } from './fixtures/legacy-surface';
import {
  prepareCalcuSurface,
  preparedSurface,
  prepareSdkCalcuSurface,
} from './manifest';

const actionId = 'calculation.propose';
const json = (value: unknown) => new JsonDocument(JSON.stringify(value));
const record = (value: unknown) => value as Record<string, unknown>;
function digest(value: unknown): string {
  const source = canonicalize(value);
  if (typeof source !== 'string') throw new Error('invalid_test_vector');
  return createHash('sha256').update(source).digest('hex');
}

// Literal oracles: old artifacts were captured before changing the builder;
// new artifacts are qualified against those immutable fixtures below.
const goldens = [
  {
    issuer: 'https://calcu.local',
    legacyFixture:
      'd564b1d5fcf02871f3b472a1cad903ff566ad49974b8bd0857028a85a4c01684',
    legacyManifest:
      '20446d6730e2fb3a8bdfa0878ca22bb08bcd94e8946ea621068fbfccb5d0ab47',
    legacyResources:
      'fbee2126cf39e4eb6d172f4ff21d5824dac910d3f3572faf4a69e03f9aed961e',
    legacyManifestJson:
      'dc548e30092b1d30615939a5899d93fc87136674e3c9da80c73320377d3afaf8',
    legacyResourcesJson:
      'e3a774b0e7c00d970886ea576737d6d9db7696f9ebf66c49a0a31209351269ed',
    legacySurface: 'sha-256:JbCWzyXu_BiZqOhg_tomfvSI2MZOIyD_yVKR-DlDbaY',
    surface: 'sha-256:lwnYCjj4ajf2hbPwQ8KDe1XGg6g9Bf8NfXTzc9VAKT0',
    input: 'sha-256:O73QlZQxtTdmeWfsCY8Dl3ce5fzhuLxyUGIVJw8srMk',
    manifest:
      '07b04cfbd6b907b5b5847a57e79248eb288625be2dd05657404d43a7e41490ea',
    resources:
      'a2efb3d4acc46ab95d8ede1c3e17d06355185f7b09141d8e89cff329ecec27ba',
    schemas: [
      '3403eb7fd21948cc8f7a6e1b39cbf6a82aa8caacf5ec87fd74bfc43149d41546',
      '0c34957f44c6a5d096cb3f92219531ba1ed68ffca536f270b44354cad68aa7c9',
      'd2f4edc22799953355b7e7d89f67983562f89a75d2ac35a2f1faf21ae45fa5f0',
      'ca5afc3ef1d65df4b1af685b56709b8012f8b3450dd4eb9ffdd3f16c379032e1',
    ],
  },
  {
    issuer: 'https://calcu.example.test',
    legacyFixture:
      '6c8f831614cc9407490dc3a7bd3b2728d6c7f7ca792016eb5242aa5679e75b62',
    legacyManifest:
      '33aa5f08c15adc5f76f281deebd1e500d3c2554d6f634930c2776639b1dad460',
    legacyResources:
      '6a77142aa23bd2ef59288b953d43fd54df2756660d15a4bb51962763fe7fd5ff',
    legacyManifestJson:
      '952fd0acd8a09744296728a02611dd26ce2e896ec304f133cd57fc1e7ea4d64f',
    legacyResourcesJson:
      'b7dfcf0eb75af7bdd8d8968bddeff2db91459c39c95d292d0130507f58f041a5',
    legacySurface: 'sha-256:E4HAtpWx1TmEpgeqacO_XTAUc-AbpGZpuqR1AC0nnMc',
    surface: 'sha-256:s4Fr7QKIfAbSkelKWwDUVl5NgLpEwtLp5YsgYWMP-YY',
    input: 'sha-256:36Kx--PsNioYBff7Xfno2Fn0c-_1TEStbF-dE2g2Aw0',
    manifest:
      '8132f398e5fe7346c22d2838d6bc5a6fe8241152581fe0ba61bbb5a8487173d3',
    resources:
      'f2c1c3cd1554a57f234d3c71a8288bc29e3d6ab32a68d8429606e295f4336043',
    schemas: [
      '1ccee1f2aec72aad7e98bfed6daa81888a79e7a45208d0622ca76c6fc1533a5b',
      '6ad1384f7d6bac7c179e9d93effedbe3ba0efcf21860daa04b628bc00048dd37',
      'd154171e01c336a7fb294d69a7ee7df795429b940a8c67af30d44a02ba450083',
      '29118afc6ccca06908bdf080c43634f57e3660656e77013788c7560545e336c2',
    ],
  },
];

describe('SDK-authored live selection and immutable legacy artifacts', () => {
  it('infers the application types without accepting an execution handle', () => {
    expectTypeOf<CalculationActionInput>().toEqualTypeOf<calcu.Calculation>();
    expectTypeOf<CalculationActionOutput>().toExtend<calcu.CalculationResult>();
    expectTypeOf<calcu.CalculationResult>().toExtend<CalculationActionOutput>();
    expectTypeOf<typeof prepareSdkCalcuSurface>().parameters.toEqualTypeOf<
      [appId?: string, issuer?: string]
    >();
  });

  it.each(
    goldens,
  )('preserves the historical legacy artifacts at $issuer', (golden) => {
    const baseline = loadLegacyCalcuSurface(golden.issuer);
    expect(digest(baseline.fixture)).toBe(golden.legacyFixture);
    expect(digest(baseline.fixture.manifest)).toBe(golden.legacyManifest);
    expect(digest(baseline.fixture.schema_resources)).toBe(
      golden.legacyResources,
    );
    const jsonDigest = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(jsonDigest(baseline.fixture.manifest)).toBe(
      golden.legacyManifestJson,
    );
    expect(jsonDigest(baseline.fixture.schema_resources)).toBe(
      golden.legacyResourcesJson,
    );
    expect(baseline.manifest.surfaceHash).toBe(golden.legacySurface);
    expect(baseline.fixture.provenance.calcu_commit).toBe(
      '7f837fd1eaad4dec78b3c7f612e52a8fa7a870a4',
    );
    const live = prepareCalcuSurface('calcu.local', golden.issuer);
    expect(live.surface.surface_version).toBe('0.1.3');
    expect(digest(live.document.parse())).toBe(golden.manifest);
    expect(live.surface.surface_hash).toBe(golden.surface);
    expect(
      digest(
        live.schemaResources.map(({ uri, document }) => ({
          uri,
          schema: document.parse(),
        })),
      ),
    ).toBe(golden.resources);
    expect(live.identityAdvertisement.parse()).toEqual(
      baseline.identityAdvertisement.parse(),
    );
  });

  it.each(
    goldens,
  )('qualifies exactly the selected delta at $issuer', (golden) => {
    const baseline = loadLegacyCalcuSurface(golden.issuer);
    const next = prepareSdkCalcuSurface('calcu.local', golden.issuer);
    const value = record(next.document.parse());
    const action = record((value.actions as unknown[])[0]);
    const old = baseline.fixture.manifest;
    const oldAction = record((old.actions as unknown[])[0]);
    const {
      actions: _oldActions,
      surface_version: _oldVersion,
      surface_hash: _oldHash,
      ...oldHost
    } = old;
    const {
      actions: _actions,
      surface_version: _version,
      surface_hash: _hash,
      ...nextHost
    } = value;
    expect(nextHost).toEqual(oldHost);
    const {
      input_schema: _oldInput,
      output_schema: _oldOutput,
      input_schema_hash: _oldInputHash,
      ...oldPolicy
    } = oldAction;
    const {
      input_schema: _input,
      output_schema: _output,
      input_schema_hash: _inputHash,
      input_hash_profile: _inputHashProfile,
      ...nextPolicy
    } = action;
    expect(nextPolicy).toEqual(oldPolicy);
    expect(action.input_hash_profile).toBe('asp-jcs-sha-256');
    expect(next.surface.action.input_hash_profile).toBe('asp-jcs-sha-256');
    expect(action.input_schema).toBe(
      `${golden.issuer}/schemas/0.1.3/${actionId}.input.json`,
    );
    expect(action.output_schema).toBe(
      `${golden.issuer}/schemas/0.1.3/${actionId}.output.json`,
    );
    expect(action.input_schema_hash).toBe(golden.input);
    expect(next.surface.surface_version).toBe('0.1.3');
    expect(next.surface.surface_hash).toBe(golden.surface);
    expect(next.manifest.surfaceHash).toBe(golden.surface);
    expect(new SurfaceSnapshot(next.document).hash()).toBe(golden.surface);
    expect(digest(value)).toBe(golden.manifest);
    const resources = next.schemaResources.map(({ uri, document }) => ({
      uri,
      schema: document.parse(),
    }));
    expect(digest(resources)).toBe(golden.resources);
    expect(resources.map(({ schema }) => digest(schema))).toEqual(
      golden.schemas,
    );
    expect(resources).toHaveLength(4);
    expect(resources.slice(2)).toEqual(
      baseline.fixture.schema_resources.slice(2),
    );
    expect(next.identityAdvertisement.parse()).toEqual(
      baseline.identityAdvertisement.parse(),
    );

    for (const [index, resource] of resources.slice(0, 2).entries()) {
      const schema = record(resource.schema);
      const oldSchema = baseline.fixture.schema_resources[index].schema;
      const properties = record(schema.properties);
      expect(properties.operator).toEqual({
        ...record(record(oldSchema.properties).operator),
        type: 'string',
      });
      expect({
        ...schema,
        $id: oldSchema.$id,
        properties: {
          ...properties,
          operator: record(oldSchema.properties).operator,
        },
      }).toEqual(oldSchema);
      expect(resource.uri).not.toBe(
        baseline.fixture.schema_resources[index].uri,
      );
      expect(schema.$id).toBe(resource.uri);
    }
    for (const name of ['handler', 'invoke', 'run', 'issue', 'grant'])
      expect(name in next).toBe(false);
    expect(
      prepareSdkCalcuSurface('calcu.local', golden.issuer).document.parse(),
    ).toEqual(value);
  });

  it('selects the qualified SDK snapshot without calling business logic', () => {
    const engine = vi.spyOn(calcu, 'calculate');
    try {
      const next = prepareSdkCalcuSurface();
      for (const [operator, left, right, result] of [
        ['add', 2, 3, 5],
        ['subtract', 5, 3, 2],
        ['multiply', 240, 0.15, 36],
        ['divide', 6, 2, 3],
      ]) {
        next.manifest.validateInput(actionId, json({ operator, left, right }));
        next.manifest.validateOutput(
          actionId,
          json({ operator, left, right, result }),
        );
      }
      expect(engine).not.toHaveBeenCalled();
      expect(preparedSurface.surface.surface_version).toBe('0.1.3');
      expect(preparedSurface.surface.surface_hash).toBe(goldens[0].surface);
    } finally {
      engine.mockRestore();
    }
  });

  it('rejects unsupported actions, malformed raw JSON and non-closed input/output', () => {
    const next = prepareSdkCalcuSurface();
    for (const source of [
      '{"operator":"sqrt","left":111,"right":2}',
      '{"operator":"multiply","left":"240","right":0.15}',
      '{"operator":"multiply","left":240}',
      '{"operator":"multiply","left":240,"right":0.15,"credential":"forbidden"}',
      '{"operator":"multiply","operator":"add","left":240,"right":0.15}',
      '{"operator":"multiply","left":-0,"right":0.15}',
      '{"operator":"multiply","left":1e999,"right":0.15}',
      '{"operator":"multiply",',
    ])
      expect(() =>
        next.manifest.validateInput(actionId, new JsonDocument(source)),
      ).toThrow();
    expect(() =>
      next.manifest.validateInput('calculation.sqrt', json({})),
    ).toThrow();
    for (const output of [
      { operator: 'multiply', left: 240, right: 0.15, result: '36' },
      { operator: 'multiply', left: 240, right: 0.15 },
      { operator: 'multiply', left: 240, right: 0.15, result: 36, extra: true },
    ])
      expect(() =>
        next.manifest.validateOutput(actionId, json(output)),
      ).toThrow();
  });

  it.each([
    'http://calcu.local',
    'https://calcu.local?query=1',
    'https://calcu.local#fragment',
  ])('rejects invalid host composition for %s', (issuer) => {
    expect(() => prepareSdkCalcuSurface('calcu.local', issuer)).toThrow();
  });
  it('rejects invalid application identity and unavailable legacy fixture selection', () => {
    expect(() => prepareSdkCalcuSurface('')).toThrow();
    expect(() => loadLegacyCalcuSurface('https://unknown.test')).toThrow(
      'unknown_legacy_fixture',
    );
  });

  it('requires referenced resources, unique URIs and matching identity/hash', () => {
    const next = prepareSdkCalcuSurface();
    const prepare = (
      resources = next.schemaResources,
      identity = next.identityAdvertisement,
    ) =>
      new OfflineProposalManifest(
        next.document,
        new OfflineSchemaResources(resources),
        identity,
      ).prepare();
    expect(() => prepare(next.schemaResources.slice(0, 2))).toThrow();
    expect(() =>
      prepare([...next.schemaResources, next.schemaResources[0]]),
    ).toThrow();
    expect(() =>
      prepare([
        loadLegacyCalcuSurface(goldens[0].issuer).schemaResources[0],
        ...next.schemaResources.slice(1),
      ]),
    ).toThrow();
    expect(() =>
      prepare(next.schemaResources, json({ profile: 'unsupported' })),
    ).toThrow();
    const mismatched = {
      ...record(next.document.parse()),
      surface_hash: goldens[0].legacySurface,
    };
    expect(() =>
      new OfflineProposalManifest(
        json(mismatched),
        new OfflineSchemaResources(next.schemaResources),
        next.identityAdvertisement,
      ).prepare(),
    ).toThrow();
  });
});

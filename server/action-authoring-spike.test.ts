// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CanonicalObjectHash,
  JsonDocument,
  OfflineProposalManifest,
  OfflineSchemaResources,
  SurfaceSnapshot,
} from '@0al/agent-surface';
import { describe, expect, it } from 'vitest';
import { calculate } from './calcu';
import { prepareCalcuSurface } from './manifest';

const ACTION_AUTHORING_COMMIT = '03fd21c8bca70968b08e4585c14d1f6971978797';
const INPUT_SCHEMA_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/action-input-schema/v1';
const FIXTURE_SCHEMA_BASE = 'https://calcu.example.test/schemas/';
const PRODUCTION_ISSUER = 'https://calcu.local';

type RecordValue = Record<string, unknown>;
type GeneratedCalcuAction = {
  actionDocuments: JsonDocument[];
  schemaResources: { uri: string; document: JsonDocument }[];
};

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('expected_object');
  return value as RecordValue;
}

function document(value: unknown) {
  return new JsonDocument(JSON.stringify(value));
}

function requireResource<
  Resource extends { uri: string; document: JsonDocument },
>(resources: readonly Resource[], uri: string): Resource {
  const resource = resources.find((candidate) => candidate.uri === uri);
  if (!resource) throw new Error('missing_schema_resource');
  return resource;
}

describe('offline action-authoring complete Calcu manifest spike', () => {
  const spikeIt =
    process.env.CALCU_ACTION_AUTHORING_SPIKE === '1' ? it : it.skip;

  spikeIt(
    'composes and validates a test-only candidate without changing runtime authority',
    async () => {
      const repo = process.env.AGENT_SURFACE_JS_ROOT;
      if (!repo)
        throw new Error(
          'Set AGENT_SURFACE_JS_ROOT to the agent-surface-js checkout',
        );
      const sdkRoot = resolve(repo);
      const sdkCommit = execFileSync(
        'git',
        ['-C', sdkRoot, 'rev-parse', 'HEAD'],
        { encoding: 'utf8' },
      ).trim();
      expect(sdkCommit).toBe(ACTION_AUTHORING_COMMIT);

      const experiment = resolve(
        sdkRoot,
        'experiments/offline-action-authoring/dist/consumers/calcu.js',
      );
      const { prepareCalcu } = await import(pathToFileURL(experiment).href);
      let handlerCalls = 0;
      const calculateReference = new Proxy(calculate, {
        apply(target, thisArgument, argumentsList) {
          handlerCalls += 1;
          return Reflect.apply(target, thisArgument, argumentsList);
        },
      });
      const generated = prepareCalcu(
        calculateReference,
      ) as GeneratedCalcuAction;

      const baseline = prepareCalcuSurface();
      expect(Object.isFrozen(baseline.schemaResources)).toBe(true);
      expect(Object.isFrozen(generated.schemaResources)).toBe(true);
      const baselineDocument = record(baseline.document.parse());
      const baselineAction = record((baselineDocument.actions as unknown[])[0]);
      const baselineInputUri = String(baselineAction.input_schema);
      const baselineOutputUri = String(baselineAction.output_schema);
      const prototypeAction = record(generated.actionDocuments[0].parse());

      const productionSchemaBase = `${PRODUCTION_ISSUER}/schemas/`;
      const remapUri = (uri: string) => {
        if (!uri.startsWith(FIXTURE_SCHEMA_BASE))
          throw new Error('unexpected_prototype_schema_uri');
        return `${productionSchemaBase}${uri.slice(FIXTURE_SCHEMA_BASE.length)}`;
      };
      const generatedResources = generated.schemaResources.map((resource) => {
        const uri = remapUri(resource.uri);
        const schema = record(resource.document.parse());
        schema.$id = uri;
        return { uri, document: document(schema) };
      });
      const generatedInputUri = remapUri(String(prototypeAction.input_schema));
      const generatedOutputUri = remapUri(
        String(prototypeAction.output_schema),
      );
      const generatedAction = {
        ...prototypeAction,
        input_schema: generatedInputUri,
        input_schema_hash: new CanonicalObjectHash(
          INPUT_SCHEMA_HASH_DOMAIN,
        ).digest(
          requireResource(generatedResources, generatedInputUri).document,
        ),
        output_schema: generatedOutputUri,
      };

      const untouchedResources = baseline.schemaResources.filter(
        (resource) =>
          resource.uri !== baselineInputUri &&
          resource.uri !== baselineOutputUri,
      );
      const candidateResources = Object.freeze([
        ...generatedResources,
        ...untouchedResources,
      ]);
      const candidateWithoutHash: RecordValue = {
        ...baselineDocument,
        actions: [generatedAction],
      };
      delete candidateWithoutHash.surface_hash;
      const candidateHash = new SurfaceSnapshot(
        document(candidateWithoutHash),
      ).hash();
      const candidateDocument = document({
        ...candidateWithoutHash,
        surface_hash: candidateHash,
      });
      const candidate = new OfflineProposalManifest(
        candidateDocument,
        new OfflineSchemaResources(candidateResources),
        baseline.identityAdvertisement,
      ).prepare();

      const { input_schema_hash: _baselineHash, ...baselineActionWithoutHash } =
        baselineAction;
      const {
        input_schema_hash: _generatedHash,
        ...generatedActionWithoutHash
      } = generatedAction;

      expect(generatedActionWithoutHash).toEqual(baselineActionWithoutHash);
      expect(generatedInputUri).toBe(baselineInputUri);
      expect(generatedOutputUri).toBe(baselineOutputUri);
      expect(candidate.surfaceHash).toBe(candidateHash);
      expect(handlerCalls).toBe(0);
      expect(Object.isFrozen(candidateResources)).toBe(true);
      candidate.validateInput(
        'calculation.propose',
        document({ operator: 'add', left: 2, right: 3 }),
      );
      candidate.validateOutput(
        'calculation.propose',
        document({ operator: 'add', left: 2, right: 3, result: 5 }),
      );
      expect(() =>
        candidate.validateInput(
          'calculation.propose',
          document({ operator: 'add', left: 2, right: 3, extra: true }),
        ),
      ).toThrow();

      const nonAction = (value: RecordValue) => {
        const {
          actions: _actions,
          surface_hash: _surfaceHash,
          ...rest
        } = value;
        return rest;
      };
      expect(nonAction(record(candidate.document.parse()))).toEqual(
        nonAction(baselineDocument),
      );
      expect(
        candidateResources.filter((item) => !generatedResources.includes(item)),
      ).toEqual(untouchedResources);

      const oldInput = requireResource(
        baseline.schemaResources,
        baselineInputUri,
      );
      const newInput = requireResource(generatedResources, generatedInputUri);
      const oldOutput = requireResource(
        baseline.schemaResources,
        baselineOutputUri,
      );
      const newOutput = requireResource(generatedResources, generatedOutputUri);
      const oldInputSchema = record(oldInput.document.parse());
      const newInputSchema = record(newInput.document.parse());
      const oldOutputSchema = record(oldOutput.document.parse());
      const newOutputSchema = record(newOutput.document.parse());

      const manualSchemaWithoutIdentity = (schema: RecordValue) => {
        const { $schema: _dialect, $id: _id, ...body } = schema;
        return body;
      };
      const generatedInputBody = manualSchemaWithoutIdentity(newInputSchema);
      const generatedOutputBody = manualSchemaWithoutIdentity(newOutputSchema);
      const manualInputBody = manualSchemaWithoutIdentity(oldInputSchema);
      const manualOutputBody = manualSchemaWithoutIdentity(oldOutputSchema);
      const manualInputOperator = record(
        record(manualInputBody.properties).operator,
      );
      const generatedInputOperator = record(
        record(generatedInputBody.properties).operator,
      );
      const manualOutputOperator = record(
        record(manualOutputBody.properties).operator,
      );
      const generatedOutputOperator = record(
        record(generatedOutputBody.properties).operator,
      );
      const generatedInputOperatorWithType = { ...generatedInputOperator };
      const generatedOutputOperatorWithType = { ...generatedOutputOperator };
      expect(generatedInputOperator).toEqual({
        ...manualInputOperator,
        type: 'string',
      });
      expect(generatedOutputOperator).toEqual({
        ...manualOutputOperator,
        type: 'string',
      });
      delete generatedInputOperator.type;
      delete generatedOutputOperator.type;
      expect(generatedInputBody).toEqual(manualInputBody);
      expect(generatedOutputBody).toEqual(manualOutputBody);
      expect(record(candidate.document.parse()).scopes).toEqual(
        baselineDocument.scopes,
      );

      const actionDifference = {
        input_schema_hash: {
          baseline: baselineAction.input_schema_hash,
          candidate: generatedAction.input_schema_hash,
        },
      };
      const report = JSON.stringify({
        actionDifference,
        schemaDifference: {
          inputOperator: {
            baseline: manualInputOperator,
            candidate: generatedInputOperatorWithType,
          },
          outputOperator: {
            baseline: manualOutputOperator,
            candidate: generatedOutputOperatorWithType,
          },
        },
        surfaceHash: {
          baseline: baseline.surface.surface_hash,
          candidate: candidate.surfaceHash,
        },
        handlerCalls,
      });
      process.stdout.write(`[P5-T7 action-authoring spike] ${report}\n`);
      expect(generatedAction.input_schema_hash).not.toBe(
        baselineAction.input_schema_hash,
      );
      expect(candidate.surfaceHash).not.toBe(baseline.surface.surface_hash);
    },
  );
});

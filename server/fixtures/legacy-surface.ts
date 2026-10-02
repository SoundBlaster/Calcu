// Test/audit baselines captured before live manifest migration. Never a host source.
import { readFileSync } from 'node:fs';
import {
  JsonDocument,
  OfflineProposalManifest,
  OfflineSchemaResources,
} from '@0al/agent-surface';

type LegacyFixture = {
  provenance: {
    calcu_commit: string;
    surface_version: string;
    purpose: string;
  };
  app_id: string;
  issuer: string;
  manifest: Record<string, unknown>;
  schema_resources: { uri: string; schema: Record<string, unknown> }[];
  identity_advertisement: Record<string, unknown>;
};

export function loadLegacyCalcuSurface(issuer: string) {
  const name =
    issuer === 'https://calcu.local'
      ? 'local'
      : issuer === 'https://calcu.example.test'
        ? 'example'
        : undefined;
  if (!name) throw new Error('unknown_legacy_fixture');
  const fixture = JSON.parse(
    readFileSync(
      new URL(`./legacy-surface-0.1.1.${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as LegacyFixture;
  const document = new JsonDocument(JSON.stringify(fixture.manifest));
  const identityAdvertisement = new JsonDocument(
    JSON.stringify(fixture.identity_advertisement),
  );
  const schemaResources = fixture.schema_resources.map(({ uri, schema }) => ({
    uri,
    document: new JsonDocument(JSON.stringify(schema)),
  }));
  const manifest = new OfflineProposalManifest(
    document,
    new OfflineSchemaResources(schemaResources),
    identityAdvertisement,
  ).prepare();
  return {
    fixture,
    document,
    identityAdvertisement,
    schemaResources,
    manifest,
  };
}

import { spawnSync } from 'node:child_process';

// Pinned public SDK subpath: no sibling checkout or private prototype required.
const result = spawnSync(
  'npx',
  ['vitest', 'run', 'server/action-authoring-spike.test.ts'],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

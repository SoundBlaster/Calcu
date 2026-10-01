import { spawnSync } from 'node:child_process';

// Pinned vendored dev dependency: no sibling checkout or ignored dist tree.
const result = spawnSync(
  'npx',
  ['vitest', 'run', 'server/action-authoring-spike.test.ts'],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

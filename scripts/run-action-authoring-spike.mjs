import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const expectedCommit = '03fd21c8bca70968b08e4585c14d1f6971978797';
const sdkRootValue = process.env.AGENT_SURFACE_JS_ROOT;
if (!sdkRootValue) {
  console.error(
    'Set AGENT_SURFACE_JS_ROOT to the pinned agent-surface-js checkout.',
  );
  process.exit(2);
}

const sdkRoot = resolve(sdkRootValue);
function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: sdkRoot,
  encoding: 'utf8',
});
if (revision.status !== 0) {
  console.error(`Cannot read git revision in ${sdkRoot}`);
  process.exit(revision.status ?? 1);
}
const actualCommit = revision.stdout.trim();
if (actualCommit !== expectedCommit) {
  console.error(
    `Expected agent-surface-js ${expectedCommit}; found ${actualCommit}`,
  );
  process.exit(2);
}

const dirty = spawnSync(
  'git',
  ['status', '--porcelain', '--untracked-files=no'],
  {
    cwd: sdkRoot,
    encoding: 'utf8',
  },
);
if (dirty.status !== 0) {
  console.error(`Cannot inspect tracked files in ${sdkRoot}`);
  process.exit(dirty.status ?? 1);
}
if (dirty.stdout.trim() !== '') {
  console.error(
    'The pinned SDK checkout has tracked local changes; use a clean checkout.',
  );
  process.exit(2);
}

// Compile from the pinned source before importing its ignored dist output.
run('npm', ['run', 'build:action-authoring-prototype'], sdkRoot);
run(
  'npx',
  ['vitest', 'run', 'server/action-authoring-spike.test.ts'],
  process.cwd(),
  { ...process.env, CALCU_ACTION_AUTHORING_SPIKE: '1' },
);

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  SERVER_ONLY_MARKERS,
  verifyClientBundle,
} from './verify-client-bundle.mjs';

const directories = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'calcu-client-bundle-'));
  directories.push(directory);
  await mkdir(join(directory, 'assets'));
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test('accepts a recursively scanned browser bundle without server material', async () => {
  const directory = await fixture();
  await writeFile(join(directory, 'index.html'), '<main>Calcu</main>');
  await mkdir(join(directory, 'assets', 'chunks'));
  await writeFile(
    join(directory, 'assets', 'chunks', 'app.js'),
    'console.log("verified application result")',
  );

  const result = await verifyClientBundle(directory);

  assert.deepEqual(result, { filesScanned: 2 });
});

test('rejects every known server-only marker without printing file contents', async (t) => {
  for (const marker of SERVER_ONLY_MARKERS) {
    await t.test(marker, async () => {
      const directory = await fixture();
      const asset = join(directory, 'assets', 'app.js');
      await writeFile(asset, `safe-prefix:${marker}:do-not-print-this-suffix`);

      await assert.rejects(verifyClientBundle(directory), (error) => {
        assert.equal(
          error.message,
          `client_bundle_contains_server_material:${marker}:assets/app.js`,
        );
        assert.doesNotMatch(error.message, /do-not-print-this-suffix/);
        return true;
      });
    });
  }
});

test('fails closed when the build output has no scannable assets', async () => {
  const directory = await fixture();
  await writeFile(join(directory, 'ignored.bin'), 'not a web asset');

  await assert.rejects(
    verifyClientBundle(directory),
    /client_bundle_has_no_scannable_assets/,
  );
});

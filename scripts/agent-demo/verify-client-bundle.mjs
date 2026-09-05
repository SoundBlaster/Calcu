import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SERVER_ONLY_MARKERS = Object.freeze([
  'agent-identity-evidence/v1',
  'credential_release',
  'session_generation',
  'grant_hash',
  'identity_artifact_hash',
  'Authorization: Bearer',
  'BEGIN PRIVATE KEY',
]);

const SCANNABLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile() && SCANNABLE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function portableRelativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}

export async function verifyClientBundle(directory) {
  const root = resolve(directory);
  const files = await collectFiles(root);
  if (files.length === 0) {
    throw new Error('client_bundle_has_no_scannable_assets');
  }

  for (const path of files) {
    const contents = await readFile(path, 'utf8');
    for (const marker of SERVER_ONLY_MARKERS) {
      if (contents.includes(marker)) {
        throw new Error(
          `client_bundle_contains_server_material:${marker}:${portableRelativePath(root, path)}`,
        );
      }
    }
  }

  return { filesScanned: files.length };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  const directory = process.argv[2];
  if (!directory) throw new Error('client_bundle_directory_required');
  const result = await verifyClientBundle(directory);
  process.stdout.write(
    `Verified browser bundle isolation (${result.filesScanned} files).\n`,
  );
}

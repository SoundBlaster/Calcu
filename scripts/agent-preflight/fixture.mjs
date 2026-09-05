import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export async function prepareFixture() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), 'calcu-preflight-'));
  try {
    const source = await readFile(
      join(root, 'src/features/calculator/lib/scientificMath.ts'),
      'utf8',
    );
    await writeFile(
      join(dir, 'math.mjs'),
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    );
    for (const name of ['calculator.mjs', 'server.mjs']) {
      await copyFile(
        join(root, 'scripts/agent-preflight', name),
        join(dir, name),
      );
    }
    return dir;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

export function inspectRequest(request) {
  if (!Array.isArray(request.input)) throw new Error('invalid_capture');
  const definitions = [
    ...(request.tools ?? []),
    ...request.input.flatMap((item) =>
      item.type === 'additional_tools' ? item.tools : [],
    ),
  ];
  const tools = definitions.map((tool) => tool.name ?? tool.type);
  // Informational only; never use descriptions as proof of an allow-list.
  const nestedToolHeadings = definitions.flatMap((tool) =>
    [...(tool.description ?? '').matchAll(/^### `([^`]+)`/gm)].map(
      (match) => match[1],
    ),
  );
  const unexpected = tools.filter(
    (name) => name !== 'mcp__calcu__calculation_propose',
  );
  const calculatorToolPresent = tools.includes(
    'mcp__calcu__calculation_propose',
  );
  const requestedModelMatches =
    request.model === 'gpt-5.6-luna' && request.reasoning?.effort === 'low';
  return {
    model: request.model,
    reasoning: request.reasoning,
    tools,
    nestedToolHeadings,
    unexpected,
    calculatorToolPresent,
    requestedModelMatches,
    initialRequestGatePassed:
      requestedModelMatches &&
      calculatorToolPresent &&
      unexpected.length === 0 &&
      definitions.length === 1 &&
      definitions[0].type === 'function',
  };
}

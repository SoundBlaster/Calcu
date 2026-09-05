import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { inspectRequest, prepareFixture } from './fixture.mjs';

test('calculator fixture uses Calcu engine and rejects invalid requests', async () => {
  const dir = await prepareFixture();
  try {
    const { calculate } = await import(
      pathToFileURL(join(dir, 'calculator.mjs'))
    );
    assert.deepEqual(
      calculate({ left: 240, operator: 'multiply', right: 0.15 }),
      { left: 240, operator: 'multiply', right: 0.15, result: 36 },
    );
    for (const input of [
      null,
      [],
      {},
      { left: 1, right: 0, operator: 'divide' },
      { left: 1, right: 1, operator: 'power' },
      { left: Infinity, right: 1, operator: 'add' },
      { left: Number.MAX_VALUE, right: 2, operator: 'multiply' },
      { left: '1', right: 2, operator: 'add' },
      { left: 1, right: 2, operator: 'add', expression: 'eval' },
    ]) {
      assert.throws(() => calculate(input));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('MCP fixture handshake, actual call, bounded calls and rejection', async () => {
  const dir = await prepareFixture();
  const child = spawn(process.execPath, [join(dir, 'server.mjs')]);
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  try {
    const requests = [
      { method: 'initialize', params: { protocolVersion: '2025-11-25' } },
      { method: 'tools/list' },
      ...Array.from({ length: 4 }, () => ({
        method: 'tools/call',
        params: {
          name: 'calculation_propose',
          arguments: { left: 240, operator: 'multiply', right: 0.15 },
        },
      })),
      { method: 'file/read' },
    ];
    const closed = new Promise((resolve, reject) => {
      child.once('close', resolve);
      child.once('error', reject);
    });
    child.stdin.end(
      `${requests
        .map((request, id) =>
          JSON.stringify({ jsonrpc: '2.0', id, ...request }),
        )
        .join('\n')}\n`,
    );
    assert.equal(await closed, 0);
    const responses = output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(responses.length, 7);
    assert.equal(responses[1].result.tools[0].name, 'calculation_propose');
    assert.equal(JSON.parse(responses[2].result.content[0].text).result, 36);
    assert.ok(responses[5].error);
    assert.ok(responses[6].error);
  } finally {
    clearTimeout(timer);
    child.kill();
    await rm(dir, { recursive: true, force: true });
  }
});

test('capture gate fails closed for extra tools, missing tool and wrong model', () => {
  const tool = { type: 'function', name: 'mcp__calcu__calculation_propose' };
  const base = {
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    input: [],
    tools: [tool],
  };
  assert.equal(inspectRequest(base).initialRequestGatePassed, true);
  assert.equal(
    inspectRequest({ ...base, tools: [{ ...tool, type: 'custom' }] })
      .initialRequestGatePassed,
    false,
  );
  assert.equal(
    inspectRequest({ ...base, tools: [tool, tool] }).initialRequestGatePassed,
    false,
  );
  assert.equal(
    inspectRequest({ ...base, tools: [] }).initialRequestGatePassed,
    false,
  );
  assert.equal(
    inspectRequest({ ...base, model: 'other' }).initialRequestGatePassed,
    false,
  );
  assert.equal(
    inspectRequest({ ...base, reasoning: { effort: 'high' } })
      .initialRequestGatePassed,
    false,
  );
  const extra = inspectRequest({
    ...base,
    input: [
      {
        type: 'additional_tools',
        tools: [{ name: 'exec', description: '### `apply_patch`\n' }],
      },
    ],
  });
  assert.equal(extra.initialRequestGatePassed, false);
  assert.deepEqual(extra.nestedToolHeadings, ['apply_patch']);
  assert.throws(() => inspectRequest({}));
});

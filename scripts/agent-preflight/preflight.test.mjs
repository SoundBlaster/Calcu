import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
  judgeDynamicProbe,
  permittedRuntimeTools,
  syntheticResponse,
  unadvertisedBindings,
} from './dynamic-case.mjs';
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

function wrappedRequest() {
  return {
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    input: [
      {
        type: 'additional_tools',
        tools: [
          {
            name: 'exec',
            type: 'custom',
            description: permittedRuntimeTools
              .map((name) => `### \`${name}\``)
              .join('\n'),
          },
          { name: 'wait', type: 'function' },
          { name: 'request_user_input', type: 'function' },
        ],
      },
    ],
  };
}

function probeCase(overrides = {}) {
  const result = { operator: 'multiply', left: 240, right: 0.15, result: 36 };
  const evidence = {
    nonce: 'case',
    inventory: [...permittedRuntimeTools],
    denied: {
      exec_command: 'unavailable',
      view_image: 'unavailable',
      apply_patch: 'unavailable',
    },
    globals: { process: 'undefined', require: 'undefined', fetch: 'undefined' },
    result: JSON.stringify(result),
    ...overrides,
  };
  const request = wrappedRequest();
  request.input.push({
    type: 'custom_tool_call_output',
    call_id: 'case',
    output: [{ type: 'input_text', text: JSON.stringify(evidence) }],
  });
  return {
    nonce: 'case',
    assessment: inspectRequest(wrappedRequest()),
    followingAssessment: inspectRequest(request),
    followingRequest: request,
    calls: [result],
  };
}

test('Code Mode advertisement is recognized but never proves runtime safety', () => {
  const request = wrappedRequest();
  const result = inspectRequest(request);
  assert.equal(result.calculatorToolPresent, true);
  assert.equal(result.wrapperCandidate, true);
  assert.equal(result.initialRequestGatePassed, false);
  assert.equal(
    judgeDynamicProbe({ assessment: result, nonce: 'case', calls: [] })
      .capabilityProbePassed,
    false,
  );
  request.input[0].tools[0].description += '\n### `exec_command`';
  assert.equal(inspectRequest(request).wrapperCandidate, false);
});

test('dynamic gate requires matching runtime inventory, result, nonce and denied capabilities', () => {
  assert.equal(judgeDynamicProbe(probeCase()).capabilityProbePassed, true);
  assert.equal(
    judgeDynamicProbe({ ...probeCase(), requestCount: 3 })
      .capabilityProbePassed,
    false,
  );
  assert.equal(
    judgeDynamicProbe({ ...probeCase(), requestCount: 1 })
      .capabilityProbePassed,
    false,
  );
  for (const overrides of [
    { inventory: [...permittedRuntimeTools, 'multi_agent_v1__spawn_agent'] },
    { inventory: [...permittedRuntimeTools, 'exec_command'] },
    { inventory: [] },
    { inventory: [...permittedRuntimeTools, 'calculation_propose'] },
    { denied: { exec_command: 'exposed' } },
    { globals: { process: 'object' } },
    { nonce: 'stale' },
    { result: '36' },
    { result: { operator: 'add', left: 18, right: 18, result: 36 } },
    { result: '{invalid json' },
    { result: { operator: 'multiply', left: 240, right: 0.15, result: 37 } },
  ])
    assert.equal(
      judgeDynamicProbe(probeCase(overrides)).capabilityProbePassed,
      false,
    );
  assert.equal(
    judgeDynamicProbe({ ...probeCase(), calls: [] }).capabilityProbePassed,
    false,
  );
  assert.equal(
    judgeDynamicProbe({ ...probeCase(), rejectedCalls: 1 })
      .capabilityProbePassed,
    false,
  );
  const changed = probeCase();
  changed.followingAssessment = inspectRequest({
    ...wrappedRequest(),
    model: 'other',
  });
  assert.equal(judgeDynamicProbe(changed).capabilityProbePassed, false);
  const duplicate = probeCase();
  duplicate.followingRequest.input.push(
    duplicate.followingRequest.input.at(-1),
  );
  assert.equal(judgeDynamicProbe(duplicate).capabilityProbePassed, false);
});

test('synthetic provider program exercises calculator and rejects missing host tools', async () => {
  const dir = await prepareFixture();
  try {
    const { calculate } = await import(
      pathToFileURL(join(dir, 'calculator.mjs'))
    );
    const reports = [];
    const calls = [];
    const tools = Object.fromEntries(
      permittedRuntimeTools.map((name) => [name, () => {}]),
    );
    tools.calculation_propose = (input) => {
      const result = calculate(input);
      calls.push(result);
      return JSON.stringify(result);
    };
    const events = syntheticResponse('case')
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
    const item = events.find(
      (event) => event.type === 'response.output_item.done',
    ).item;
    assert.equal(item.call_id, 'case');
    await runInNewContext(
      `(async () => { ${item.input} })()`,
      { tools, text: (report) => reports.push(report) },
      { timeout: 1000 },
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].result, 36);
    assert.equal(reports[0].denied.exec_command, 'unavailable');
    assert.equal(reports[0].denied.apply_patch, 'unavailable');
    assert.equal(reports[0].globals.process, 'undefined');
    const fixture = probeCase();
    fixture.followingRequest.input.at(-1).output[0].text = JSON.stringify(
      reports[0],
    );
    assert.equal(judgeDynamicProbe(fixture).capabilityProbePassed, true);
    for (const name of unadvertisedBindings) {
      assert.equal(reports[0].dispatchDiagnostics[name].status, 'absent');
    }

    // Argument rejection cannot turn an unexpected callable into an allowed one.
    // Exercise both thrown validation errors and returned values (including errors).
    for (const returnsValue of [false, true]) {
      const attempts = [];
      for (const name of unadvertisedBindings) {
        tools[name] = (args) => {
          assert.equal(JSON.stringify(args), '{}');
          attempts.push(name);
          if (returnsValue) return 'validation error';
          throw new Error('missing field');
        };
      }
      reports.length = 0;
      await runInNewContext(
        `(async () => { ${item.input} })()`,
        { tools, text: (report) => reports.push(report) },
        { timeout: 1000 },
      );
      assert.deepEqual(attempts, unadvertisedBindings);
      for (const name of unadvertisedBindings) {
        assert.equal(
          reports[0].dispatchDiagnostics[name].status,
          returnsValue ? 'returned' : 'threw',
        );
      }
      fixture.followingRequest.input.at(-1).output[0].text = JSON.stringify(
        reports[0],
      );
      assert.equal(judgeDynamicProbe(fixture).capabilityProbePassed, false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

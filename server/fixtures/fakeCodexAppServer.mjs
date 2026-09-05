import readline from 'node:readline';

const scenario = process.argv[2] ?? 'success';
const threadId = 'thread-calcu';
const turnId = 'turn-calcu';
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

if (scenario === 'nonzero') process.exit(7);

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.id === 0 && message.method === 'initialize') {
    send({
      id: 0,
      result: { serverInfo: { name: 'fake', version: '0.145.0' } },
    });
    return;
  }
  if (message.method === 'initialized') return;
  if (message.id === 1) {
    const params = message.params;
    const tool = params.dynamicTools?.[0];
    if (
      params.model !== 'gpt-5.6-luna' ||
      params.ephemeral !== true ||
      params.approvalPolicy !== 'never' ||
      params.sandbox !== 'read-only' ||
      params.allowProviderModelFallback !== false ||
      JSON.stringify(params.environments) !== '[]' ||
      JSON.stringify(params.selectedCapabilityRoots) !== '[]' ||
      params.dynamicTools?.length !== 1 ||
      tool?.name !== 'calculation_propose' ||
      tool?.inputSchema?.additionalProperties !== false
    )
      process.exit(3);
    send({ id: 1, result: { thread: { id: threadId } } });
    return;
  }
  if (message.id === 2) {
    if (
      message.params.model !== 'gpt-5.6-luna' ||
      message.params.effort !== 'low' ||
      JSON.stringify(message.params.environments) !== '[]'
    )
      process.exit(4);
    send({ id: 2, result: { turn: { id: turnId } } });
    if (scenario === 'timeout') return;
    if (scenario === 'malformed') {
      process.stdout.write('{broken json\n');
      return;
    }
    if (scenario === 'truncated') {
      process.stdout.write('{"partial"');
      process.exit(0);
    }
    if (scenario === 'oversized_line') {
      process.stdout.write('x'.repeat(256 * 1024 + 1));
      return;
    }
    if (scenario === 'unknown_request') {
      send({ id: 88, method: 'fake/unknown', params: {} });
      return;
    }
    if (scenario === 'no_tool') {
      send({
        method: 'item/agentMessage/delta',
        params: {
          threadId,
          turnId,
          itemId: 'message-1',
          delta: 'The answer is 36.',
        },
      });
      send({
        method: 'turn/completed',
        params: { threadId, turn: { id: turnId, status: 'completed' } },
      });
      return;
    }
    if (scenario === 'auth_error' || scenario === 'model_error') {
      send({
        method: 'turn/completed',
        params: {
          threadId,
          turn: {
            id: turnId,
            status: 'failed',
            error: {
              message:
                scenario === 'auth_error'
                  ? 'Not logged in to the configured provider'
                  : 'Model is unavailable for this account',
            },
          },
        },
      });
      return;
    }
    send({
      id: 0,
      method: 'item/tool/call',
      params: {
        threadId: scenario === 'wrong_thread' ? 'other-thread' : threadId,
        turnId: scenario === 'wrong_turn' ? 'other-turn' : turnId,
        callId: scenario === 'invalid_call' ? '' : 'call-calcu-1',
        namespace: null,
        tool: scenario === 'wrong_tool' ? 'other_tool' : 'calculation_propose',
        arguments: { operator: 'multiply', left: 240, right: 0.15 },
      },
    });
    return;
  }
  if (message.id === 0 && !message.method) {
    if (scenario === 'double_tool') {
      send({
        id: 101,
        method: 'item/tool/call',
        params: {
          threadId,
          turnId,
          callId: 'call-calcu-2',
          namespace: null,
          tool: 'calculation_propose',
          arguments: { operator: 'multiply', left: 240, right: 0.15 },
        },
      });
      return;
    }
    send({
      method: 'item/agentMessage/delta',
      params: {
        threadId,
        turnId,
        itemId: 'message-1',
        delta:
          scenario === 'fabricated_prose'
            ? 'I calculated 999.'
            : 'The verified Calcu result is 36.',
      },
    });
    send({
      method: 'turn/completed',
      params: { threadId, turn: { id: turnId, status: 'completed' } },
    });
  }
});

export type CalculationArguments = {
  operator: 'add' | 'subtract' | 'multiply' | 'divide';
  left: number;
  right: number;
};

export type CalculationResult = CalculationArguments & { result: number };

export type SafeTaskTrace = {
  model: 'gpt-5.6-luna';
  effort: 'low';
  tool_name: 'calculation_propose';
  call_id: string;
  operands: CalculationArguments;
};

export type TaskStreamEvent =
  | { type: 'task.accepted'; task_id: string }
  | { type: 'task.progress'; task_id: string; phase: string }
  | {
      type: 'task.tool_result';
      task_id: string;
      application_result: CalculationResult;
      trace: SafeTaskTrace;
    }
  | {
      type: 'task.completed';
      task_id: string;
      application_result: CalculationResult;
      agent_message?: string;
      trace: SafeTaskTrace;
    }
  | { type: 'task.failed'; task_id: string; error: { code: string } }
  | { type: 'task.cancelled'; task_id: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('malformed_stream');
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[]) {
  const result = record(value);
  if (
    JSON.stringify(Object.keys(result).sort()) !==
    JSON.stringify([...keys].sort())
  )
    throw new Error('malformed_stream');
  return result;
}

function identifier(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 256)
    throw new Error('malformed_stream');
  return value;
}

function finite(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('malformed_stream');
  return value;
}

function argumentsFromRecord(
  input: Record<string, unknown>,
): CalculationArguments {
  if (
    input.operator !== 'add' &&
    input.operator !== 'subtract' &&
    input.operator !== 'multiply' &&
    input.operator !== 'divide'
  )
    throw new Error('malformed_stream');
  return {
    operator: input.operator,
    left: finite(input.left),
    right: finite(input.right),
  };
}

function argumentsValue(value: unknown): CalculationArguments {
  return argumentsFromRecord(exact(value, ['operator', 'left', 'right']));
}

function resultValue(value: unknown): CalculationResult {
  const output = exact(value, ['operator', 'left', 'right', 'result']);
  return { ...argumentsFromRecord(output), result: finite(output.result) };
}

function traceValue(value: unknown): SafeTaskTrace {
  const trace = exact(value, [
    'model',
    'effort',
    'tool_name',
    'call_id',
    'operands',
  ]);
  if (
    trace.model !== 'gpt-5.6-luna' ||
    trace.effort !== 'low' ||
    trace.tool_name !== 'calculation_propose'
  )
    throw new Error('malformed_stream');
  return {
    model: trace.model,
    effort: trace.effort,
    tool_name: trace.tool_name,
    call_id: identifier(trace.call_id),
    operands: argumentsValue(trace.operands),
  };
}

export function parseTaskStreamEvent(line: string): TaskStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error('malformed_stream');
  }
  const base = record(value);
  const type = base.type;
  const taskId = identifier(base.task_id);
  if (type === 'task.accepted') {
    exact(base, ['type', 'task_id']);
    return { type, task_id: taskId };
  }
  if (type === 'task.progress') {
    const event = exact(base, ['type', 'task_id', 'phase']);
    return { type, task_id: taskId, phase: identifier(event.phase) };
  }
  if (type === 'task.tool_result') {
    const event = exact(base, [
      'type',
      'task_id',
      'application_result',
      'trace',
    ]);
    return {
      type,
      task_id: taskId,
      application_result: resultValue(event.application_result),
      trace: traceValue(event.trace),
    };
  }
  if (type === 'task.completed') {
    const keys = Object.keys(base);
    const hasMessage = keys.includes('agent_message');
    const event = exact(base, [
      'type',
      'task_id',
      'application_result',
      'trace',
      ...(hasMessage ? ['agent_message'] : []),
    ]);
    if (
      hasMessage &&
      (typeof event.agent_message !== 'string' ||
        new TextEncoder().encode(event.agent_message).byteLength > 8 * 1024)
    )
      throw new Error('malformed_stream');
    return {
      type,
      task_id: taskId,
      application_result: resultValue(event.application_result),
      trace: traceValue(event.trace),
      ...(hasMessage ? { agent_message: event.agent_message as string } : {}),
    };
  }
  if (type === 'task.failed') {
    const event = exact(base, ['type', 'task_id', 'error']);
    const error = exact(event.error, ['code']);
    return { type, task_id: taskId, error: { code: identifier(error.code) } };
  }
  if (type === 'task.cancelled') {
    exact(base, ['type', 'task_id']);
    return { type, task_id: taskId };
  }
  throw new Error('malformed_stream');
}

export async function consumeTaskStream(
  response: Response,
  signal: AbortSignal,
  onEvent: (event: TaskStreamEvent) => void,
) {
  if (!response.ok) {
    if (response.status === 409) throw new Error('task_busy');
    if (response.status === 400) throw new Error('task_invalid');
    throw new Error('task_service_unavailable');
  }
  if (
    response.headers.get('content-type')?.split(';')[0] !==
      'application/x-ndjson' ||
    !response.body
  )
    throw new Error('task_service_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 64 * 1024) throw new Error('malformed_stream');
      buffer += decoder.decode(value, { stream: true });
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (line) onEvent(parseTaskStreamEvent(line));
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) throw new Error('malformed_stream');
  } finally {
    reader.releaseLock();
  }
}

export function sameResult(left: CalculationResult, right: CalculationResult) {
  return (
    left.operator === right.operator &&
    left.left === right.left &&
    left.right === right.right &&
    left.result === right.result
  );
}

export function sameTrace(left: SafeTaskTrace, right: SafeTaskTrace) {
  return (
    left.model === right.model &&
    left.effort === right.effort &&
    left.tool_name === right.tool_name &&
    left.call_id === right.call_id &&
    left.operands.operator === right.operands.operator &&
    left.operands.left === right.operands.left &&
    left.operands.right === right.operands.right
  );
}

export function verifiedResult(
  result: CalculationResult,
  trace: SafeTaskTrace,
) {
  return (
    result.operator === trace.operands.operator &&
    result.left === trace.operands.left &&
    result.right === trace.operands.right &&
    Number.isFinite(result.result)
  );
}

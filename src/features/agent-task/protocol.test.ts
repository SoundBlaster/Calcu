import { describe, expect, it, vi } from 'vitest';
import { consumeTaskStream, parseTaskStreamEvent } from './protocol';

const accepted = JSON.stringify({ type: 'task.accepted', task_id: 'task-1' });
const completed = JSON.stringify({
  type: 'task.completed',
  task_id: 'task-1',
  application_result: {
    operator: 'multiply',
    left: 240,
    right: 0.15,
    result: 36,
  },
  trace: {
    model: 'gpt-5.6-luna',
    effort: 'low',
    tool_name: 'calculation_propose',
    call_id: 'call-1',
    operands: { operator: 'multiply', left: 240, right: 0.15 },
  },
});

function streamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    },
  );
}

describe('task stream protocol', () => {
  it('parses NDJSON across arbitrary chunk boundaries', async () => {
    const onEvent = vi.fn();
    const payload = `${accepted}\n${completed}\n`;
    await consumeTaskStream(
      streamingResponse([
        payload.slice(0, 7),
        payload.slice(7, 53),
        payload.slice(53),
      ]),
      new AbortController().signal,
      onEvent,
    );
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1]?.[0].application_result.result).toBe(36);
  });

  it('rejects extra fields, fabricated numeric types and truncated lines', async () => {
    expect(() =>
      parseTaskStreamEvent(
        JSON.stringify({
          type: 'task.accepted',
          task_id: 'task-1',
          credential: 'forbidden',
        }),
      ),
    ).toThrow('malformed_stream');
    expect(() =>
      parseTaskStreamEvent(completed.replace('"result":36', '"result":"36"')),
    ).toThrow('malformed_stream');
    await expect(
      consumeTaskStream(
        streamingResponse([accepted]),
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('malformed_stream');
  });
});

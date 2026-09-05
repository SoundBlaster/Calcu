import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTaskPanel } from './AgentTaskPanel';

const result = {
  operator: 'multiply',
  left: 240,
  right: 0.15,
  result: 36,
};
const trace = {
  model: 'gpt-5.6-luna',
  effort: 'low',
  tool_name: 'calculation_propose',
  call_id: 'call-safe',
  operands: { operator: 'multiply', left: 240, right: 0.15 },
};

function response(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
          ),
        );
        controller.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
}

const accepted = { type: 'task.accepted', task_id: 'task-1' };
const toolResult = {
  type: 'task.tool_result',
  task_id: 'task-1',
  application_result: result,
  trace,
};
const completed = {
  type: 'task.completed',
  task_id: 'task-1',
  application_result: result,
  agent_message: 'The verified result is 36.',
  trace,
};

describe('AgentTaskPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function render() {
    act(() => root.render(<AgentTaskPanel />));
  }

  function button(label: string) {
    const found = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );
    if (!found) throw new Error(`Missing button ${label}`);
    return found;
  }

  it('submits a task and separates the verified result from agent prose', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response([accepted, toolResult, completed]));
    render();
    await act(async () => button('Run with Codex').click());

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks/run',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(container.textContent).toContain('240 × 0.15 = 36');
    expect(container.textContent).toContain('The verified result is 36.');
    expect(container.textContent).toContain('Safe trace');
  });

  it('rejects an agent-only answer and supports retry', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response([
          accepted,
          {
            type: 'task.completed',
            task_id: 'task-1',
            application_result: result,
            trace,
          },
        ]),
      )
      .mockResolvedValueOnce(response([accepted, toolResult, completed]));
    render();
    await act(async () => button('Run with Codex').click());
    expect(container.textContent).toContain('Task failed: unverified_result');

    await act(async () => button('Run with Codex').click());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('240 × 0.15 = 36');
  });

  it('rejects a terminal result that differs from the tool evidence', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response([
        accepted,
        toolResult,
        {
          ...completed,
          application_result: { ...result, result: 999 },
        },
      ]),
    );
    render();
    await act(async () => button('Run with Codex').click());
    expect(container.textContent).toContain('Task failed: unverified_result');
    expect(container.textContent).not.toContain('= 999');
  });

  it('cancels a running request and ignores its late completion', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolvePromise) => {
          resolveFetch = resolvePromise;
        }),
    );
    render();
    act(() => button('Run with Codex').click());
    act(() => button('Cancel').click());
    expect(container.textContent).toContain('Task cancelled.');

    await act(async () => {
      resolveFetch?.(response([accepted, toolResult, completed]));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Task cancelled.');
    expect(container.textContent).not.toContain('240 × 0.15 = 36');
  });
});

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
  agent_message: 'Calcu returned 36.',
  trace,
};
const rootTask = 'Сколько будет корень из 111 умноженный на 2?';
const rootResult = {
  operator: 'multiply',
  left: 111,
  right: 2,
  result: 222,
} as const;
const rootTrace = {
  ...trace,
  operands: { operator: 'multiply', left: 111, right: 2 },
} as const;

function rootEvents() {
  return [
    accepted,
    {
      type: 'task.tool_result',
      task_id: 'task-1',
      application_result: rootResult,
      trace: rootTrace,
    },
    {
      type: 'task.completed',
      task_id: 'task-1',
      application_result: rootResult,
      agent_message: 'По результату приложения: 222.',
      trace: rootTrace,
    },
  ];
}

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

  function changeTask(value: string) {
    const input = container.querySelector('textarea');
    if (!input) throw new Error('Missing task input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('separates the requested task, verified action, and agent prose', async () => {
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
    expect(container.textContent).toContain('Requested task');
    expect(container.textContent).toContain('Сколько будет 15% от 240?');
    expect(container.textContent).toContain('Verified application action');
    expect(container.textContent).not.toContain('Verified Calcu result');
    expect(container.querySelector('[role="note"]')?.textContent).toContain(
      'does not verify that the operation fully represents the natural-language task',
    );
    expect(container.textContent).toContain('Agent message (unverified)');
    expect(container.textContent).toContain('Calcu returned 36.');
    expect(container.textContent).toContain('Safe trace');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Application action completed.',
    );
    expect(container.querySelector('output')?.getAttribute('aria-label')).toBe(
      'Verified application action result',
    );
  });

  it('shows the requested root task separately from the admitted multiplication', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(rootEvents()));
    render();
    changeTask(rootTask);
    await act(async () => button('Run with Codex').click());

    expect(container.textContent).toContain(rootTask);
    expect(container.textContent).toContain('111 × 2 = 222');
    expect(container.textContent).toContain('Verified application action');
    expect(container.textContent).not.toContain('√111');
    expect(container.textContent).not.toContain('21.07');
    expect(container.textContent).not.toContain('task was solved correctly');
  });

  it('keeps the submitted task immutable until the next generation', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(rootEvents()))
      .mockResolvedValueOnce(response([accepted, toolResult, completed]));
    render();
    changeTask(rootTask);
    await act(async () => button('Run with Codex').click());

    changeTask('Сколько будет 15% от 240?');
    const requested = container.querySelector(
      '[aria-labelledby="requested-task-label"]',
    );
    expect(requested?.textContent).toContain(rootTask);
    expect(requested?.textContent).not.toContain('15% от 240');

    await act(async () => button('Run with Codex').click());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nextRequested = container.querySelector(
      '[aria-labelledby="requested-task-label"]',
    );
    expect(nextRequested?.textContent).toContain('Сколько будет 15% от 240?');
    expect(nextRequested?.textContent).not.toContain(rootTask);
    expect(container.textContent).toContain('240 × 0.15 = 36');
    expect(container.textContent).not.toContain('111 × 2 = 222');
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
    expect(container.textContent).not.toContain('Verified application action');
  });
});

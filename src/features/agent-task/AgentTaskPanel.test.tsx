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

function mockTaskFetch(surfaceVersion = '0.1.2') {
  const run = vi.fn<typeof fetch>();
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
    if (url === '/api/tasks/permissions') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            offer_id: 'a'.repeat(64),
            expires_at: Date.now() + 60_000,
            action_id: 'calculation.propose',
            surface_version: surfaceVersion,
            retention: 'user_managed',
            data_classes: [
              {
                id: 'calculation.content',
                label: 'Calculation content',
                classification: 'sensitive',
              },
              {
                id: 'calculation.runtime_context',
                label: 'Runtime context',
                classification: 'sensitive',
              },
              {
                id: 'calculation.status',
                label: 'Calculation status',
                classification: 'private',
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    return run(url, options);
  });
  return run;
}
const rootTask = 'What is the square root of 111 multiplied by 2?';
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
      agent_message: 'The application returned 222.',
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
    vi.useRealTimers();
  });

  function aspDetails() {
    return Array.from(container.querySelectorAll('details')).find(
      (details) =>
        details.querySelector('summary')?.textContent === 'ASP details',
    );
  }

  it('shows collapsed public ASP details from the server without granting access', async () => {
    const run = mockTaskFetch('opaque-draft/next');
    render();
    expect(aspDetails()).toBeUndefined();
    await reviewAccess();
    expect(aspDetails()?.open).toBe(false);
    expect(aspDetails()?.textContent).toContain('Surface version');
    expect(aspDetails()?.textContent).toContain('opaque-draft/next');
    expect(aspDetails()?.textContent).toContain('Allowed action');
    expect(aspDetails()?.textContent).toContain('calculation.propose');
    expect(aspDetails()?.textContent).not.toMatch(
      /grant|credential|passport|receipt|identity/i,
    );
    expect(run).not.toHaveBeenCalled();
    changeTask('A new task');
    expect(aspDetails()).toBeUndefined();
  });

  it('keeps submitted ASP metadata with its result and replaces it on a fresh review', async () => {
    mockTaskFetch('reviewed-version').mockResolvedValue(
      response([accepted, toolResult, completed]),
    );
    render();
    await runTask();
    expect(container.querySelector('fieldset')).toBeNull();
    expect(aspDetails()?.textContent).toContain('reviewed-version');
    changeTask('A new task');
    expect(aspDetails()?.textContent).toContain('reviewed-version');
    mockTaskFetch('replacement-version').mockResolvedValue(
      response([accepted, toolResult, completed]),
    );
    await reviewAccess();
    expect(aspDetails()?.textContent).toContain('replacement-version');
    expect(aspDetails()?.textContent).not.toContain('reviewed-version');
    await act(async () => button('Allow and run with Codex').click());
    expect(aspDetails()?.textContent).toContain('replacement-version');
    expect(container.textContent).toContain('Application action completed.');
  });

  it('expires the visible offer and requests fresh unchecked permissions', async () => {
    vi.useFakeTimers();
    const run = mockTaskFetch();
    await render();
    await reviewAccess();
    expect(container.querySelector('time')?.textContent).toBe('01:00');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(container.querySelector('time')?.textContent).toBe('00:00');
    expect(
      Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ).every((input) => input.disabled),
    ).toBe(true);
    await act(async () => {
      button('Review access').click();
    });
    expect(container.querySelector('time')?.textContent).toBe('01:00');
    expect(
      Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ).every((input) => !input.checked && !input.disabled),
    ).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('invalidates selected permissions when choosing a different example', async () => {
    const run = mockTaskFetch();
    await render();
    await reviewAccess();
    await act(async () => {
      button('Add 38 and 57').click();
    });
    expect(container.querySelector('textarea')?.value).toBe('Add 38 and 57');
    expect(container.querySelector('fieldset')).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  function render() {
    act(() => root.render(<AgentTaskPanel />));
  }

  it('explains disclosure and revocation limits before a task is submitted', () => {
    render();
    const text = container.textContent ?? '';
    expect(text).toContain(
      'agent also receives the operation, operands and result.',
    );
    expect(text).toContain('responsible for how it handles disclosed data.');
    expect(text).toContain('does not delete information already disclosed.');
  });

  function button(label: string) {
    const found = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );
    if (!found) throw new Error(`Missing button ${label}`);
    return found;
  }

  async function reviewAccess() {
    await act(async () => button('Review access').click());
    act(() => {
      container
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((item) => {
          item.click();
        });
    });
  }

  async function runTask() {
    await reviewAccess();
    await act(async () => button('Allow and run with Codex').click());
  }

  it('requires both permissions and invalidates the selection when the task changes', async () => {
    const run = mockTaskFetch().mockResolvedValue(
      response([accepted, toolResult, completed]),
    );
    render();
    expect(container.querySelector('fieldset')).toBeNull();
    await act(async () => button('Review access').click());
    expect(button('Allow and run with Codex').disabled).toBe(true);
    const checks = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    act(() => checks.item(0).click());
    expect(button('Allow and run with Codex').disabled).toBe(true);
    act(() => checks.item(1).click());
    expect(button('Allow and run with Codex').disabled).toBe(false);
    changeTask('Another calculation');
    expect(container.querySelector('fieldset')).toBeNull();
    expect(button('Review access').disabled).toBe(false);
    expect(run).not.toHaveBeenCalled();
    await runTask();
    const body = JSON.parse(String(run.mock.calls[0]?.[1]?.body));
    expect(body.task).toBe('Another calculation');
    expect(body.permission.actions).toEqual(['calculation.propose']);
    expect(body.permission.data_classes).toHaveLength(3);
    expect(container.querySelector('fieldset')).toBeNull();
  });

  it('does not enable execution after a malformed access offer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ offer_id: 'forged' })),
    );
    render();
    await act(async () => button('Review access').click());
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.textContent).toContain('permission_unavailable');
  });

  it('requires a fresh review when the selected offer expires', async () => {
    const run = mockTaskFetch().mockResolvedValue(
      response([accepted, toolResult, completed]),
    );
    render();
    await reviewAccess();
    const time = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(time + 61_000);
    await act(async () => button('Allow and run with Codex').click());
    expect(run).not.toHaveBeenCalled();
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.textContent).toContain('permission_required');
  });

  it('ignores a cancelled preview that finishes late', async () => {
    const run = mockTaskFetch();
    const implementation = vi.mocked(fetch).getMockImplementation();
    if (!implementation) throw new Error('Missing test implementation');
    let release: (() => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      (url, options) =>
        new Promise<Response>((resolve) => {
          release = () => {
            void implementation(url, options).then(resolve);
          };
        }),
    );
    render();
    act(() => button('Review access').click());
    act(() => button('Cancel').click());
    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.textContent).toContain('Task cancelled.');
    expect(run).not.toHaveBeenCalled();
  });

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
    const fetchMock = mockTaskFetch().mockResolvedValue(
      response([accepted, toolResult, completed]),
    );
    render();
    await runTask();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks/run',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(container.textContent).toContain('240 × 0.15 = 36');
    expect(container.textContent).toContain('Requested task');
    expect(container.textContent).toContain('What is 15% of 240?');
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
    mockTaskFetch().mockResolvedValue(response(rootEvents()));
    render();
    changeTask(rootTask);
    await runTask();

    expect(container.textContent).toContain(rootTask);
    expect(container.textContent).toContain('111 × 2 = 222');
    expect(container.textContent).toContain('Verified application action');
    expect(container.textContent).not.toContain('√111');
    expect(container.textContent).not.toContain('21.07');
    expect(container.textContent).not.toContain('task was solved correctly');
  });

  it('keeps the submitted task immutable until the next generation', async () => {
    const fetchMock = mockTaskFetch()
      .mockResolvedValueOnce(response(rootEvents()))
      .mockResolvedValueOnce(response([accepted, toolResult, completed]));
    render();
    changeTask(rootTask);
    await runTask();

    changeTask('What is 15% of 240?');
    const requested = container.querySelector(
      '[aria-labelledby="requested-task-label"]',
    );
    expect(requested?.textContent).toContain(rootTask);
    expect(requested?.textContent).not.toContain('15% of 240');

    await runTask();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nextRequested = container.querySelector(
      '[aria-labelledby="requested-task-label"]',
    );
    expect(nextRequested?.textContent).toContain('What is 15% of 240?');
    expect(nextRequested?.textContent).not.toContain(rootTask);
    expect(container.textContent).toContain('240 × 0.15 = 36');
    expect(container.textContent).not.toContain('111 × 2 = 222');
  });

  it('rejects an agent-only answer and supports retry', async () => {
    const fetchMock = mockTaskFetch()
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
    await runTask();
    expect(container.textContent).toContain('Task failed: unverified_result');
    expect(aspDetails()).toBeUndefined();

    await runTask();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('240 × 0.15 = 36');
  });

  it('rejects a terminal result that differs from the tool evidence', async () => {
    mockTaskFetch().mockResolvedValue(
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
    await runTask();
    expect(container.textContent).toContain('Task failed: unverified_result');
    expect(container.textContent).not.toContain('= 999');
  });

  it('cancels a running request and ignores its late completion', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    mockTaskFetch().mockImplementation(
      () =>
        new Promise<Response>((resolvePromise) => {
          resolveFetch = resolvePromise;
        }),
    );
    render();
    await reviewAccess();
    act(() => button('Allow and run with Codex').click());
    act(() => button('Cancel').click());
    expect(container.textContent).toContain('Task cancelled.');

    await act(async () => {
      resolveFetch?.(response([accepted, toolResult, completed]));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Task cancelled.');
    expect(container.textContent).not.toContain('240 × 0.15 = 36');
    expect(container.textContent).not.toContain('Verified application action');
    expect(aspDetails()).toBeUndefined();
  });
});

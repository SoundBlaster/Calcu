import { useRef, useState } from 'react';
import styles from './AgentTaskPanel.module.css';
import {
  type CalculationResult,
  consumeTaskStream,
  type SafeTaskTrace,
  sameResult,
  sameTrace,
  type TaskStreamEvent,
  verifiedResult,
} from './protocol';

type PanelState = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

const EXAMPLE = 'Сколько будет 15% от 240?';

const OPERATOR_LABELS: Record<CalculationResult['operator'], string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

export function AgentTaskPanel() {
  const [task, setTask] = useState(EXAMPLE);
  const [state, setState] = useState<PanelState>('idle');
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState<CalculationResult>();
  const [trace, setTrace] = useState<SafeTaskTrace>();
  const [agentMessage, setAgentMessage] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const activeController = useRef<AbortController | undefined>(undefined);

  const clearOutput = () => {
    setResult(undefined);
    setTrace(undefined);
    setAgentMessage('');
    setError('');
    setPhase('');
  };

  const submit = async () => {
    const currentGeneration = ++generation.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    clearOutput();
    setState('running');
    let streamTaskId: string | undefined;
    let toolSeen = false;
    let terminalSeen = false;
    let verifiedToolResult: CalculationResult | undefined;
    let verifiedToolTrace: SafeTaskTrace | undefined;

    const applyEvent = (event: TaskStreamEvent) => {
      if (generation.current !== currentGeneration || controller.signal.aborted)
        return;
      if (terminalSeen) throw new Error('malformed_stream');
      if (!streamTaskId) {
        if (event.type !== 'task.accepted') throw new Error('malformed_stream');
        streamTaskId = event.task_id;
      } else if (event.task_id !== streamTaskId) {
        throw new Error('malformed_stream');
      } else if (event.type === 'task.accepted') {
        throw new Error('malformed_stream');
      }
      if (event.type === 'task.progress') setPhase(event.phase);
      if (event.type === 'task.tool_result') {
        if (toolSeen || !verifiedResult(event.application_result, event.trace))
          throw new Error('unverified_result');
        toolSeen = true;
        verifiedToolResult = event.application_result;
        verifiedToolTrace = event.trace;
        setResult(event.application_result);
        setTrace(event.trace);
      }
      if (event.type === 'task.completed') {
        if (
          terminalSeen ||
          !toolSeen ||
          !verifiedToolResult ||
          !verifiedToolTrace ||
          !sameResult(event.application_result, verifiedToolResult) ||
          !sameTrace(event.trace, verifiedToolTrace) ||
          !verifiedResult(event.application_result, event.trace)
        )
          throw new Error('unverified_result');
        terminalSeen = true;
        setResult(event.application_result);
        setTrace(event.trace);
        setAgentMessage(event.agent_message ?? '');
        setState('success');
      }
      if (event.type === 'task.failed') {
        terminalSeen = true;
        setError(event.error.code);
        setState('error');
      }
      if (event.type === 'task.cancelled') {
        terminalSeen = true;
        setState('cancelled');
      }
    };

    try {
      const response = await fetch('/api/tasks/run', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: task.trim() }),
        signal: controller.signal,
      });
      await consumeTaskStream(response, controller.signal, applyEvent);
      if (
        generation.current === currentGeneration &&
        !controller.signal.aborted &&
        !terminalSeen
      )
        throw new Error('malformed_stream');
    } catch (caught) {
      if (generation.current !== currentGeneration) return;
      if (controller.signal.aborted) {
        setState('cancelled');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'task_failed');
      setState('error');
    } finally {
      if (generation.current === currentGeneration)
        activeController.current = undefined;
    }
  };

  const cancel = () => {
    generation.current += 1;
    activeController.current?.abort();
    activeController.current = undefined;
    setState('cancelled');
    setPhase('');
  };

  return (
    <section className={styles.panel} aria-labelledby="agent-task-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>ASP mediated demo</p>
        <h1 id="agent-task-title">Ask Codex to calculate</h1>
        <p className={styles.disclosure}>
          Текст задачи отправляется настроенному model provider. ASP authority,
          Grant и credentials остаются в локальном server boundary.
        </p>
      </header>

      <label className={styles.label} htmlFor="agent-task-input">
        Задача
      </label>
      <textarea
        id="agent-task-input"
        className={styles.input}
        value={task}
        maxLength={4096}
        rows={4}
        disabled={state === 'running'}
        onChange={(event) => setTask(event.target.value)}
      />
      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="button"
          disabled={state === 'running' || !task.trim()}
          onClick={() => void submit()}
        >
          Run with Codex
        </button>
        {state === 'running' ? (
          <button className={styles.secondary} type="button" onClick={cancel}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className={styles.status} role="status" aria-live="polite">
        {state === 'running' ? `Running${phase ? ` · ${phase}` : '…'}` : null}
        {state === 'cancelled' ? 'Task cancelled.' : null}
        {state === 'error' ? `Task failed: ${error}` : null}
        {state === 'success' && result && trace ? (
          <div className={styles.resultBlock}>
            <p className={styles.verifiedLabel}>Verified Calcu result</p>
            <output className={styles.result}>
              {result.left} {OPERATOR_LABELS[result.operator]} {result.right} ={' '}
              {result.result}
            </output>
            {agentMessage ? (
              <p className={styles.agentMessage}>{agentMessage}</p>
            ) : null}
            <details className={styles.trace}>
              <summary>Safe trace</summary>
              <dl>
                <dt>Model</dt>
                <dd>{trace.model}</dd>
                <dt>Effort</dt>
                <dd>{trace.effort}</dd>
                <dt>Tool</dt>
                <dd>{trace.tool_name}</dd>
                <dt>Call</dt>
                <dd>{trace.call_id}</dd>
                <dt>Operands</dt>
                <dd>
                  {trace.operands.left}{' '}
                  {OPERATOR_LABELS[trace.operands.operator]}{' '}
                  {trace.operands.right}
                </dd>
              </dl>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}

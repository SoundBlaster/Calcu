import { useRef, useState } from 'react';
import styles from './AgentTaskPanel.module.css';
import { readPermissionOffer, type TaskPermissionOffer } from './permissions';
import {
  type CalculationResult,
  consumeTaskStream,
  type SafeTaskTrace,
  sameResult,
  sameTrace,
  type TaskStreamEvent,
  verifiedResult,
} from './protocol';

type PanelState =
  | 'idle'
  | 'reviewing'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

const EXAMPLE = 'What is 15% of 240?';

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
  const [submittedTask, setSubmittedTask] = useState('');
  const [result, setResult] = useState<CalculationResult>();
  const [trace, setTrace] = useState<SafeTaskTrace>();
  const [agentMessage, setAgentMessage] = useState('');
  const [error, setError] = useState('');
  const [offer, setOffer] = useState<TaskPermissionOffer>();
  const [reviewedTask, setReviewedTask] = useState('');
  const [allowAction, setAllowAction] = useState(false);
  const [allowData, setAllowData] = useState(false);
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
    const taskSnapshot = task.trim();
    if (
      !offer ||
      !allowAction ||
      !allowData ||
      reviewedTask !== taskSnapshot ||
      offer.expires_at <= Date.now()
    ) {
      setOffer(undefined);
      setError('permission_required');
      setState('error');
      return;
    }
    const permission = {
      offer_id: offer.offer_id,
      actions: [offer.action_id],
      data_classes: offer.data_classes.map((item) => item.id),
    };
    setOffer(undefined);
    setAllowAction(false);
    setAllowData(false);
    const currentGeneration = ++generation.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    clearOutput();
    setSubmittedTask(taskSnapshot);
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
        body: JSON.stringify({ task: taskSnapshot, permission }),
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

  const reviewAccess = async () => {
    const taskSnapshot = task.trim();
    const currentGeneration = ++generation.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setOffer(undefined);
    setAllowAction(false);
    setAllowData(false);
    setError('');
    setState('reviewing');
    try {
      const response = await fetch('/api/tasks/permissions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: taskSnapshot }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('permission_unavailable');
      const text = await response.text();
      if (text.length > 4096) throw new Error('permission_invalid');
      const permissionOffer = readPermissionOffer(JSON.parse(text));
      if (generation.current !== currentGeneration || controller.signal.aborted)
        return;
      setOffer(permissionOffer);
      setReviewedTask(taskSnapshot);
      setState('idle');
    } catch {
      if (generation.current !== currentGeneration || controller.signal.aborted)
        return;
      setError('permission_unavailable');
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
    setOffer(undefined);
    setAllowAction(false);
    setAllowData(false);
  };

  return (
    <section className={styles.panel} aria-labelledby="agent-task-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>ASP mediated demo</p>
        <h1 id="agent-task-title">Ask Codex to calculate</h1>
        <p className={styles.disclosure}>
          Your task is sent to the configured model provider. ASP authority,
          Grant and credentials remain within the local server boundary. The
          agent also receives the operation, operands and result. You choose the
          agent and are responsible for how it handles disclosed data. Revoking
          access prevents new calls but does not delete information already
          disclosed.
        </p>
      </header>

      <label className={styles.label} htmlFor="agent-task-input">
        Task
      </label>
      <textarea
        id="agent-task-input"
        className={styles.input}
        value={task}
        maxLength={4096}
        rows={4}
        disabled={state === 'running'}
        onChange={(event) => {
          setTask(event.target.value);
          setOffer(undefined);
          setAllowAction(false);
          setAllowData(false);
          if (state === 'reviewing') {
            generation.current += 1;
            activeController.current?.abort();
            activeController.current = undefined;
            setState('idle');
          }
        }}
      />
      {offer ? (
        <fieldset>
          <legend>Access for this task</legend>
          <p>
            Codex (gpt-5.6-luna, low) may request one calculation. This does not
            approve an exact operation or verify your task's meaning.
          </p>
          <label>
            <input
              type="checkbox"
              checked={allowAction}
              onChange={(event) => setAllowAction(event.target.checked)}
            />
            Allow calculation.propose: add, subtract, multiply or divide. No
            other application actions.
          </label>
          <ul>
            {offer.data_classes.map((item) => (
              <li key={item.id}>
                {item.label} ({item.classification})
              </li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={allowData}
              onChange={(event) => setAllowData(event.target.checked)}
            />
            Allow the operation, operands, result and runtime context to be
            disclosed. Agent data handling is user-managed.
          </label>
          <p>
            Both permissions are required for this action. Decline by leaving
            them unchecked; the ordinary calculator remains available. This
            selection expires after one minute and is used once.
          </p>
        </fieldset>
      ) : null}
      <div className={styles.actions}>
        {!offer ? (
          <button
            className={styles.primary}
            type="button"
            disabled={
              state === 'running' || state === 'reviewing' || !task.trim()
            }
            onClick={() => void reviewAccess()}
          >
            Review access
          </button>
        ) : (
          <button
            className={styles.primary}
            type="button"
            disabled={!allowAction || !allowData || !task.trim()}
            onClick={() => void submit()}
          >
            Allow and run with Codex
          </button>
        )}
        {state === 'running' || state === 'reviewing' ? (
          <button className={styles.secondary} type="button" onClick={cancel}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className={styles.status} role="status" aria-live="polite">
        {state === 'reviewing' ? 'Loading access request…' : null}
        {state === 'running' ? `Running${phase ? ` · ${phase}` : '…'}` : null}
        {state === 'cancelled' ? 'Task cancelled.' : null}
        {state === 'error' ? `Task failed: ${error}` : null}
        {state === 'success' ? 'Application action completed.' : null}
      </div>
      {state === 'success' && result && trace && submittedTask ? (
        <div className={styles.resultBlock}>
          <section
            className={styles.resultSection}
            aria-labelledby="requested-task-label"
          >
            <p className={styles.verifiedLabel} id="requested-task-label">
              Requested task
            </p>
            <p className={styles.requestedTask}>{submittedTask}</p>
          </section>
          <section
            className={styles.resultSection}
            aria-labelledby="verified-action-label"
          >
            <p className={styles.verifiedLabel} id="verified-action-label">
              Verified application action
            </p>
            <output
              className={styles.result}
              aria-label="Verified application action result"
            >
              {result.left} {OPERATOR_LABELS[result.operator]} {result.right} ={' '}
              {result.result}
            </output>
          </section>
          <div className={styles.scopeNote} role="note">
            <p className={styles.verifiedLabel}>Scope of verification</p>
            <p>
              Calcu verified that this displayed operation was admitted and
              executed through the ASP boundary. It does not verify that the
              operation fully represents the natural-language task.
            </p>
          </div>
          {agentMessage ? (
            <section
              className={styles.resultSection}
              aria-labelledby="agent-message-label"
            >
              <p className={styles.verifiedLabel} id="agent-message-label">
                Agent message (unverified)
              </p>
              <p className={styles.agentMessage}>{agentMessage}</p>
            </section>
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
                {trace.operands.left} {OPERATOR_LABELS[trace.operands.operator]}{' '}
                {trace.operands.right}
              </dd>
            </dl>
          </details>
        </div>
      ) : null}
    </section>
  );
}

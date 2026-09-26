import { randomBytes, randomUUID } from 'node:crypto';
import { JsonDocument } from '@0al/agent-surface';
import { type CalculationResult, exact, validateCalculation } from './calcu';
import {
  type Binding,
  type RuntimeAccess,
  surface,
  type Transport,
} from './executor';
import { canonicalHash } from './hash';
import {
  type ActionReceipt,
  type CreateReceiptContext,
  createRuntimeReceipt,
  type ReceiptContext,
  verifyApplicationReceipt,
} from './receipts';

const ACTION_INPUT_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/action-input/v1';
const ACTION_OUTPUT_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/action-output/v1';
const ACTION_EXECUTION_HASH_DOMAIN =
  'https://github.com/0al-spec/agent-surface/hash/action-execution/v1';

const receiptHistory = new WeakMap<object, ActionReceipt[]>();

function cloneBinding(binding: Binding): Binding {
  return {
    ...binding,
    subject: { ...binding.subject },
    delegate: { ...binding.delegate },
  };
}

/** Server-only receipt inspection for tests and trusted host code. */
export function localReceiptHistory(backend: object): readonly ActionReceipt[] {
  return (receiptHistory.get(backend) ?? []).map((receipt) =>
    structuredClone(receipt),
  );
}

// Only calculationPropose is agent-facing. The returned ActionReceipt values
// stay in this server-side history and never become tool or browser output.
export function createLocalBackend(
  access: RuntimeAccess,
  transport: Transport,
  now: () => number = Date.now,
) {
  const credential = access.credential;
  const binding = cloneBinding(access.binding);
  const receipts: ActionReceipt[] = [];
  const backend = {
    async calculationPropose(args: unknown, signal?: AbortSignal) {
      const input = validateCalculation(args);
      const correlation = {
        ...binding,
        action_id: surface.action.id,
        trace_id: randomBytes(16).toString('hex'),
        span_id: randomBytes(8).toString('hex'),
      };
      const execution = {
        mode: surface.action.execution.mode,
        execution_id: randomUUID(),
      } as const;
      const context: CreateReceiptContext = {
        ...binding,
        action_id: surface.action.id,
        trace_id: correlation.trace_id,
        span_id: correlation.span_id,
        runtime_id: binding.delegate.runtime,
        agent_id: binding.delegate.agent,
        identity_evidence_hash: binding.identity_evidence_hash,
        user: binding.subject.user,
        idempotency_key: `idem_${randomUUID()}`,
        input_hash: canonicalHash(ACTION_INPUT_HASH_DOMAIN, input),
        execution,
        execution_hash: canonicalHash(ACTION_EXECUTION_HASH_DOMAIN, execution),
        issuerId: binding.delegate.runtime,
        now: new Date(now()).toISOString(),
      };
      const runtimeReceipt = createRuntimeReceipt(context);
      receipts.push(runtimeReceipt);
      const request = JSON.stringify({
        type: 'action.request',
        payload: {
          ...correlation,
          idempotency_key: context.idempotency_key,
          parent_receipt_hash: runtimeReceipt.receipt_hash,
          runtime_receipt: runtimeReceipt,
          input_hash: context.input_hash,
          execution,
          execution_hash: context.execution_hash,
          input,
        },
      });
      const response = await transport(credential, request, signal);
      if (Buffer.byteLength(response) > 8192)
        throw new Error('invalid_response');
      let decoded: unknown;
      try {
        decoded = new JsonDocument(response).parse(8192);
      } catch {
        throw new Error('invalid_response');
      }
      const envelope = exact(decoded, ['type', 'payload']);
      if (envelope.type !== 'action.result')
        throw new Error('invalid_response');
      const payload = exact(envelope.payload, [
        ...Object.keys(correlation),
        'idempotency_key',
        'parent_receipt_hash',
        'input_hash',
        'execution',
        'execution_hash',
        'result',
        'output',
        'receipt',
      ]);
      for (const key of Object.keys(
        correlation,
      ) as (keyof typeof correlation)[])
        if (JSON.stringify(payload[key]) !== JSON.stringify(correlation[key]))
          throw new Error('invalid_response');
      if (
        payload.idempotency_key !== context.idempotency_key ||
        payload.parent_receipt_hash !== runtimeReceipt.receipt_hash ||
        payload.input_hash !== context.input_hash ||
        payload.execution_hash !== context.execution_hash ||
        JSON.stringify(payload.execution) !== JSON.stringify(execution)
      )
        throw new Error('invalid_response');
      const output = exact(payload.output, [
        'operator',
        'left',
        'right',
        'result',
      ]);
      if (
        payload.result !== 'success' ||
        output.operator !== input.operator ||
        output.left !== input.left ||
        output.right !== input.right ||
        typeof output.result !== 'number' ||
        !Number.isFinite(output.result)
      )
        throw new Error('invalid_response');
      const outputHash = canonicalHash(ACTION_OUTPUT_HASH_DOMAIN, output);
      const receiptContext: ReceiptContext = {
        ...context,
        span_id: context.span_id,
      };
      const appReceipt = verifyApplicationReceipt(payload.receipt, {
        context: receiptContext,
        parentReceiptHash: runtimeReceipt.receipt_hash,
        outputHash,
      });
      receipts.push(appReceipt);
      return { ...output } as CalculationResult;
    },
  };
  receiptHistory.set(backend, receipts);
  return backend;
}

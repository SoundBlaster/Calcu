import { exact } from './calcu';
import type { Binding } from './executor';
import type { ActionReceipt } from './receipts';

export const INLINE_PROFILE =
  'https://github.com/0al-spec/agent-surface/profiles/http-inline-receipts/v1';
export const INLINE_EXTENSION =
  'https://github.com/0al-spec/agent-surface/extensions/http-inline-receipts/v1';
export const INLINE_COMMON = [
  'session_id',
  'session_generation',
  'grant_id',
  'grant_hash',
  'surface_hash',
  'action_id',
  'idempotency_key',
  'trace_id',
  'execution_hash',
  'span_id',
  'execution',
] as const;

/** Selected wire only. Binding is issuer-owned, not derived from receipt claims. */
export function expandInlineRequest(value: unknown, binding: Binding) {
  const envelope = exact(value, ['type', 'payload']);
  if (envelope.type !== 'action.request') throw new Error('schema_invalid');
  const payload = exact(envelope.payload, [
    ...INLINE_COMMON,
    'parent_receipt_hash',
    'input_hash',
    'input',
    INLINE_EXTENSION,
  ]);
  const carrier = exact(payload[INLINE_EXTENSION], [
    'profile',
    'runtime_receipt',
  ]);
  if (carrier.profile !== INLINE_PROFILE) throw new Error('schema_invalid');
  const { [INLINE_EXTENSION]: _carrier, ...ordinary } = payload;
  return {
    type: envelope.type,
    payload: {
      ...binding,
      ...ordinary,
      runtime_receipt: carrier.runtime_receipt,
    },
  };
}

/** Transform a fully validated local response into the selected external wire. */
export function inlineResult(value: {
  payload: Record<string, unknown> & { receipt: ActionReceipt };
}) {
  const payload = value.payload;
  const receipt = payload.receipt;
  return {
    type: 'action.result',
    payload: {
      ...Object.fromEntries(
        INLINE_COMMON.map((field) => [field, payload[field]]),
      ),
      span_id: receipt.span_id,
      result: payload.result,
      output: payload.output,
      receipt_id: receipt.receipt_id,
      receipt_hash: receipt.receipt_hash,
      [INLINE_EXTENSION]: { profile: INLINE_PROFILE, app_receipt: receipt },
    },
  };
}

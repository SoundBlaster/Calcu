// Test-only Calcu composition. Production continues to use localBackend.ts.
import { randomBytes, randomUUID } from 'node:crypto';
import { JsonDocument } from '@0al/agent-surface';
import { type CalculationResult, exact, validateCalculation } from '../calcu';
import {
  CALCULATION_ACTION_ID,
  CALCULATION_MODE,
} from '../calculation-declaration';
import type { RuntimeAccess, Transport } from '../executor';
import {
  type ActionReceipt,
  createRuntimeReceipt,
  verifyApplicationReceipt,
} from '../receipts';
import { ProposalExchange } from './proposalExchange';

const receiptHistory = new WeakMap<object, ActionReceipt[]>();

export function candidateReceiptHistory(
  backend: object,
): readonly ActionReceipt[] {
  return (receiptHistory.get(backend) ?? []).map((receipt) =>
    structuredClone(receipt),
  );
}

export function createProposalExchangeBackend(
  access: RuntimeAccess,
  transport: Transport,
  now: () => number = Date.now,
) {
  const credential = access.credential;
  const binding = new JsonDocument(JSON.stringify(access.binding));
  const issuerId = access.binding.delegate.runtime;
  const receipts: ActionReceipt[] = [];
  const backend = {
    async calculationPropose(args: unknown, signal?: AbortSignal) {
      if (signal?.aborted) throw new Error('aborted');
      const input = Object.freeze({ ...validateCalculation(args) });
      const exchange = new ProposalExchange(
        CALCULATION_ACTION_ID,
        new JsonDocument(
          JSON.stringify({
            binding: binding.parse(),
            trace_id: randomBytes(16).toString('hex'),
            span_id: randomBytes(8).toString('hex'),
            idempotency_key: `idem_${randomUUID()}`,
            execution: { mode: CALCULATION_MODE, execution_id: randomUUID() },
            input,
          }),
        ),
        { request: 8192, response: 8192 },
      ).prepare((context) => {
        const receipt = createRuntimeReceipt({
          ...context,
          issuerId,
          now: new Date(now()).toISOString(),
        });
        receipts.push(receipt);
        return new JsonDocument(JSON.stringify(receipt));
      });
      const response = await transport(credential, exchange.request(), signal);
      if (signal?.aborted) throw new Error('aborted');
      return exchange.readResult(response, (value, receipt, evidence) => {
        const output = exact(value, ['operator', 'left', 'right', 'result']);
        if (
          output.operator !== input.operator ||
          output.left !== input.left ||
          output.right !== input.right ||
          typeof output.result !== 'number' ||
          !Number.isFinite(output.result)
        )
          throw new Error('invalid_response');
        const appReceipt = verifyApplicationReceipt(receipt, evidence);
        receipts.push(appReceipt);
        return { ...output } as CalculationResult;
      });
    },
  };
  receiptHistory.set(backend, receipts);
  return backend;
}

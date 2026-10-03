import {
  JsonDocument,
  type PreparedOfflineSelectedGrant,
} from '@0al/agent-surface';
import { OfflineInlineProposalExchange } from '@0al/offline-proposal-exchange-experiment';
import type { RuntimeAccess, Transport } from '../executor';
import {
  INLINE_COMMON,
  INLINE_EXTENSION,
  INLINE_PROFILE,
} from '../inlineReceiptWire';
import { createLocalBackend } from '../localBackend';
import type { PreparedCalcuSurface } from '../manifest';

/** Test-only integration pilot. Native host policy/acceptance remains independent. */
export function createInlineProposalBackend(
  access: RuntimeAccess,
  prepared: PreparedCalcuSurface,
  grant: PreparedOfflineSelectedGrant,
  transport: Transport,
  now: () => number,
) {
  const binding = structuredClone(access.binding);
  const json = (value: unknown) => new JsonDocument(JSON.stringify(value));
  return createLocalBackend(
    access,
    async (credential, body, signal) => {
      const local = new JsonDocument(body).parse(8192) as {
        payload: Record<string, unknown>;
      };
      const payload = local.payload;
      const request = json({
        type: 'action.request',
        payload: {
          ...Object.fromEntries(
            INLINE_COMMON.map((field) => [field, payload[field]]),
          ),
          parent_receipt_hash: payload.parent_receipt_hash,
          input_hash: payload.input_hash,
          input: payload.input,
          [INLINE_EXTENSION]: {
            profile: INLINE_PROFILE,
            runtime_receipt: payload.runtime_receipt,
          },
        },
      });
      // Issuer/session context comes from trusted access; never response or receipt.
      const expected = json({
        ...Object.fromEntries(
          INLINE_COMMON.map((field) => [field, payload[field]]),
        ),
        grant_id: binding.grant_id,
        grant_hash: binding.grant_hash,
        session_id: binding.session_id,
        session_generation: binding.session_generation,
        surface_hash: binding.surface_hash,
        action_id: 'calculation.propose',
        input_hash: payload.input_hash,
        app_id: binding.app_id,
        surface_version: binding.surface_version,
        runtime: { runtime_id: binding.delegate.runtime },
        actor_agent: {
          agent_id: binding.delegate.agent,
          identity_evidence_hash: binding.identity_evidence_hash,
        },
        subject: { ...binding.subject },
        policies: {
          runtime: { id: 'calcu-runtime-admission', version: '0.1.0' },
          application: { id: 'calcu-app-admission', version: '0.1.0' },
        },
      });
      const retained = new OfflineInlineProposalExchange(
        prepared.manifest,
        grant,
        request,
        expected,
        8192,
      ).prepare();
      const result = await transport(
        credential,
        JSON.stringify(retained.request().parse()),
        signal,
      );
      if (signal?.aborted) throw new Error('aborted');
      try {
        const checked = retained.checkReceiptIntegrity(
          new JsonDocument(result),
        );
        const receipts = checked.receipts().parse() as {
          app: Record<string, unknown>;
        };
        // LocalBackend still performs its own domain/input/receipt acceptance.
        return JSON.stringify({
          type: 'action.result',
          payload: {
            ...payload,
            ...binding,
            result: 'success',
            output: checked.unverifiedOutput().parse(),
            receipt: receipts.app,
            runtime_receipt: undefined,
            input: undefined,
          },
        });
      } catch {
        throw new Error('invalid_response');
      }
    },
    now,
  );
}

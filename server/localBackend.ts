import { randomBytes } from 'node:crypto';
import { exact, validateCalculation } from './calcu';
import {
  type Binding,
  type RuntimeAccess,
  surface,
  type Transport,
} from './executor';

// Only this returned function is agent-facing. Credentials/control-plane methods
// remain in trusted server closures, not in tool arguments or tool results.
export function createLocalBackend(
  access: RuntimeAccess,
  transport: Transport,
) {
  const credential = access.credential;
  const binding: Binding = {
    ...access.binding,
    subject: { ...access.binding.subject },
    delegate: { ...access.binding.delegate },
  };
  return {
    async calculationPropose(args: unknown, signal?: AbortSignal) {
      const input = validateCalculation(args);
      const correlation = {
        ...binding,
        action_id: surface.action.id,
        trace_id: randomBytes(16).toString('hex'),
        span_id: randomBytes(8).toString('hex'),
      };
      const request = JSON.stringify({
        type: 'action.request',
        payload: {
          ...correlation,
          execution: { mode: surface.action.execution.mode },
          input,
        },
      });
      const response = await transport(credential, request, signal);
      if (Buffer.byteLength(response) > 8192)
        throw new Error('invalid_response');
      let decoded: unknown;
      try {
        decoded = JSON.parse(response);
      } catch {
        throw new Error('invalid_response');
      }
      const envelope = exact(decoded, ['type', 'payload']);
      if (envelope.type !== 'action.result')
        throw new Error('invalid_response');
      const payload = exact(envelope.payload, [
        ...Object.keys(correlation),
        'result',
        'output',
      ]);
      for (const key of Object.keys(
        correlation,
      ) as (keyof typeof correlation)[])
        if (JSON.stringify(payload[key]) !== JSON.stringify(correlation[key]))
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
      return { ...output };
    },
  };
}

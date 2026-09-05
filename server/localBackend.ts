import { randomBytes } from 'node:crypto';
import { exact, validateCalculation } from './calcu';
import { type RuntimeAccess, surface, type Transport } from './executor';

// Only this returned function is agent-facing. Credentials/control-plane methods
// remain in trusted server closures, not in tool arguments or tool results.
export function createLocalBackend(
  access: RuntimeAccess,
  transport: Transport,
) {
  const credential = access.credential;
  const binding = { ...access.binding };
  return {
    calculationPropose(args: unknown) {
      const input = validateCalculation(args);
      const correlation = {
        ...binding,
        action_id: surface.action_id,
        trace_id: randomBytes(16).toString('hex'),
        span_id: randomBytes(8).toString('hex'),
      };
      const request = JSON.stringify({
        type: 'action.request',
        payload: { ...correlation, execution: { mode: 'propose' }, input },
      });
      const response = transport(credential, request);
      if (Buffer.byteLength(response) > 8192)
        throw new Error('invalid_response');
      const envelope = exact(JSON.parse(response), ['type', 'payload']);
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
        if (payload[key] !== correlation[key])
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

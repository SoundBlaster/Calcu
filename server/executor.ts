import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { calculate, exact, validateCalculation } from './calcu';

// Local development contract, not a complete ASP manifest or Grant document.
export const surface = Object.freeze({
  action_id: 'calculation.propose',
  surface_mode: 'proposal_only',
  mode: 'propose',
  side_effect: false,
  operators: Object.freeze(['add', 'subtract', 'multiply', 'divide']),
});
const digest = (text: string) =>
  `sha-256:${createHash('sha256').update(text).digest('base64url')}`;
// Hashes identify local snapshots only; no ASP JCS hash-profile claim.
const surfaceHash = digest(JSON.stringify(surface));
export type Binding = {
  session_id: string;
  session_generation: number;
  grant_id: string;
  grant_hash: string;
  surface_hash: string;
  subject: { user: string };
  delegate: { runtime: string; agent: string };
  audience: string;
};
export type RuntimeAccess = { credential: string; binding: Binding };
export type Transport = (credential: string, body: string) => string;
export type GrantIssueOptions = {
  user?: string;
  runtime?: string;
  agent?: string;
  audience?: string;
};
const cloneBinding = (binding: Binding): Binding => ({
  ...binding,
  subject: { ...binding.subject },
  delegate: { ...binding.delegate },
});

export function createCalcuExecutor(now = Date.now) {
  const grants = new Map<
    string,
    { binding: Binding; expires: number; active: boolean; remaining: number }
  >();
  let engineCalls = 0;

  // Trusted application control plane only. Never expose to a model or browser.
  function issue(options: GrantIssueOptions = {}): RuntimeAccess {
    const credential = randomBytes(32).toString('base64url');
    const grant_id = randomUUID();
    const expires = now() + 60_000;
    const bindingBase = {
      session_id: randomUUID(),
      session_generation: 1,
      grant_id,
      surface_hash: surfaceHash,
      subject: { user: options.user ?? 'calcu-user-local' },
      delegate: {
        runtime: options.runtime ?? 'calcu-runtime-local',
        agent: options.agent ?? 'calcu-agent-local',
      },
      audience: options.audience ?? 'https://calcu.local/agent-actions',
    };
    const binding: Binding = {
      ...bindingBase,
      grant_hash: digest(JSON.stringify({ ...bindingBase, expires })),
    };
    grants.set(digest(credential), {
      binding,
      expires,
      active: true,
      remaining: 3,
    });
    return { credential, binding: cloneBinding(binding) };
  }

  const invoke: Transport = (credential, body) => {
    if (typeof credential !== 'string' || credential.length !== 43)
      throw new Error('unauthorized');
    const grant = grants.get(digest(credential));
    if (
      !grant ||
      !grant.active ||
      !Number.isFinite(now()) ||
      now() >= grant.expires
    )
      throw new Error('unauthorized');
    if (typeof body !== 'string' || Buffer.byteLength(body) > 8192)
      throw new Error('schema_invalid');
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      throw new Error('schema_invalid');
    }
    const envelope = exact(decoded, ['type', 'payload']);
    if (envelope.type !== 'action.request') throw new Error('schema_invalid');
    const payload = exact(envelope.payload, [
      ...Object.keys(grant.binding),
      'action_id',
      'trace_id',
      'span_id',
      'execution',
      'input',
    ]);
    for (const key of Object.keys(grant.binding) as (keyof Binding)[])
      if (JSON.stringify(payload[key]) !== JSON.stringify(grant.binding[key]))
        throw new Error('binding_mismatch');
    if (payload.action_id !== surface.action_id)
      throw new Error('action_not_allowed');
    const execution = exact(payload.execution, ['mode']);
    if (execution.mode !== surface.mode) throw new Error('action_not_allowed');
    if (
      typeof payload.trace_id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(payload.trace_id) ||
      /^0+$/.test(payload.trace_id) ||
      typeof payload.span_id !== 'string' ||
      !/^[a-f0-9]{16}$/.test(payload.span_id) ||
      /^0+$/.test(payload.span_id)
    )
      throw new Error('schema_invalid');
    const input = validateCalculation(payload.input);
    if (grant.remaining <= 0) throw new Error('quota_exceeded');
    // Synchronous admission and pure execution: no await/revocation race.
    grant.remaining--;
    engineCalls++;
    const output = calculate(input);
    return JSON.stringify({
      type: 'action.result',
      payload: {
        ...grant.binding,
        action_id: surface.action_id,
        trace_id: payload.trace_id,
        span_id: payload.span_id,
        result: 'success',
        output,
      },
    });
  };

  return {
    invoke,
    issue,
    revoke(credential: string) {
      const grant = grants.get(digest(credential));
      if (grant) grant.active = false;
    },
    rotateSession(credential: string) {
      const grant = grants.get(digest(credential));
      if (grant) grant.binding.session_generation++;
    },
    get engineCalls() {
      return engineCalls;
    },
  };
}

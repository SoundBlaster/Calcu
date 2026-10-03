import { randomUUID } from 'node:crypto';
import { exact } from './calcu';
import { canonicalHash } from './hash';

const ASP = 'https://github.com/0al-spec/agent-surface/hash/';
const POLICY_DECISION_HASH_DOMAIN = `${ASP}policy-decision/v1`;
const RECEIPT_HASH_DOMAIN = `${ASP}receipt/v1`;

export type PolicyDecision = {
  type: 'policy.decision';
  decision_id: string;
  enforcer: { type: 'runtime' | 'application'; id: string };
  outcome: 'allow';
  policy: { id: string; version: string };
  reason_code: string;
  matched_rules: string[];
  safe_to_show: string;
  evaluated_at: string;
  policy_decision_hash: string;
};

export type ActionReceipt = {
  receipt_id: string;
  receipt_type: 'runtime' | 'app';
  receipt_hash: string;
  parent_receipt_hash?: string;
  grant_id: string;
  grant_hash: string;
  session_id: string;
  session_generation: number;
  trace_id: string;
  span_id: string;
  action_id: 'calculation.propose';
  app_id: string;
  surface_version: string;
  surface_hash: string;
  runtime: { runtime_id: string };
  actor_agent: { agent_id: string; identity_evidence_hash: string };
  subject: { user: string };
  idempotency_key: string;
  input_hash: string;
  execution: { mode: 'propose'; execution_id: string };
  execution_hash: string;
  policy_decision: PolicyDecision;
  policy_decision_hash: string;
  timestamp: string;
  result: 'authorized_for_forwarding' | 'success';
  output_hash?: string;
};

export type ReceiptContext = {
  grant_id: string;
  grant_hash: string;
  session_id: string;
  session_generation: number;
  trace_id: string;
  span_id: string;
  action_id: 'calculation.propose';
  app_id: string;
  surface_version: string;
  surface_hash: string;
  runtime_id: string;
  agent_id: string;
  identity_evidence_hash: string;
  user: string;
  idempotency_key: string;
  input_hash: string;
  execution: { mode: 'propose'; execution_id: string };
  execution_hash: string;
};

export type CreateReceiptContext = ReceiptContext & {
  issuerId: string;
  now: string;
};

function hashPolicyDecision(
  decision: Omit<PolicyDecision, 'policy_decision_hash'>,
) {
  return canonicalHash(POLICY_DECISION_HASH_DOMAIN, decision);
}

function createPolicyDecision(
  role: 'runtime' | 'application',
  issuerId: string,
  now: string,
): PolicyDecision {
  const base: Omit<PolicyDecision, 'policy_decision_hash'> = {
    type: 'policy.decision',
    decision_id: `pdec_${randomUUID()}`,
    enforcer: { type: role, id: issuerId },
    outcome: 'allow',
    policy: {
      id:
        role === 'runtime' ? 'calcu-runtime-admission' : 'calcu-app-admission',
      version: '0.1.0',
    },
    reason_code: 'policy_allowed',
    matched_rules:
      role === 'runtime'
        ? ['grant.local_snapshot_present', 'action.selected_for_forwarding']
        : ['grant.active', 'surface.calculation.propose'],
    safe_to_show:
      role === 'runtime'
        ? 'The local mediator forwarded the proposal under its selected Grant snapshot; application admission is separate.'
        : 'The application admitted and evaluated the proposal action.',
    evaluated_at: now,
  };
  return { ...base, policy_decision_hash: hashPolicyDecision(base) };
}

function receiptHash(receipt: Omit<ActionReceipt, 'receipt_hash'>) {
  return canonicalHash(RECEIPT_HASH_DOMAIN, receipt);
}

function createReceipt(
  role: 'runtime' | 'app',
  context: CreateReceiptContext,
  parentReceiptHash?: string,
  outputHash?: string,
): ActionReceipt {
  const policyDecision = createPolicyDecision(
    role === 'runtime' ? 'runtime' : 'application',
    context.issuerId,
    context.now,
  );
  const base: Omit<ActionReceipt, 'receipt_hash'> = {
    ...(parentReceiptHash ? { parent_receipt_hash: parentReceiptHash } : {}),
    receipt_id: `receipt_${role}_${randomUUID()}`,
    receipt_type: role,
    grant_id: context.grant_id,
    grant_hash: context.grant_hash,
    session_id: context.session_id,
    session_generation: context.session_generation,
    trace_id: context.trace_id,
    span_id: context.span_id,
    action_id: context.action_id,
    app_id: context.app_id,
    surface_version: context.surface_version,
    surface_hash: context.surface_hash,
    runtime: { runtime_id: context.runtime_id },
    actor_agent: {
      agent_id: context.agent_id,
      identity_evidence_hash: context.identity_evidence_hash,
    },
    subject: { user: context.user },
    idempotency_key: context.idempotency_key,
    input_hash: context.input_hash,
    execution: { ...context.execution },
    execution_hash: context.execution_hash,
    policy_decision: policyDecision,
    policy_decision_hash: policyDecision.policy_decision_hash,
    timestamp: context.now,
    result: role === 'runtime' ? 'authorized_for_forwarding' : 'success',
    ...(outputHash ? { output_hash: outputHash } : {}),
  };
  return { ...base, receipt_hash: receiptHash(base) };
}

export function createRuntimeReceipt(
  context: CreateReceiptContext,
): ActionReceipt {
  return createReceipt('runtime', context);
}

export function createApplicationReceipt(
  context: CreateReceiptContext,
  parentReceiptHash: string,
  outputHash: string,
): ActionReceipt {
  return createReceipt('app', context, parentReceiptHash, outputHash);
}

function verifyReceipt(
  value: unknown,
  expected: {
    context: ReceiptContext;
    receiptType: 'runtime' | 'app';
    parentReceiptHash?: string;
    outputHash?: string;
  },
): ActionReceipt {
  const requiredKeys = [
    'receipt_id',
    'receipt_type',
    'receipt_hash',
    'grant_id',
    'grant_hash',
    'session_id',
    'session_generation',
    'trace_id',
    'span_id',
    'action_id',
    'app_id',
    'surface_version',
    'surface_hash',
    'runtime',
    'actor_agent',
    'subject',
    'idempotency_key',
    'input_hash',
    'execution',
    'execution_hash',
    'policy_decision',
    'policy_decision_hash',
    'timestamp',
    'result',
  ];
  if (expected.receiptType === 'app')
    requiredKeys.push('parent_receipt_hash', 'output_hash');
  const receipt = exact(value, requiredKeys);
  const context = expected.context;
  const runtime = exact(receipt.runtime, ['runtime_id']);
  const actor = exact(receipt.actor_agent, [
    'agent_id',
    'identity_evidence_hash',
  ]);
  const subject = exact(receipt.subject, ['user']);
  const execution = exact(receipt.execution, ['mode', 'execution_id']);
  const decision = exact(receipt.policy_decision, [
    'type',
    'decision_id',
    'enforcer',
    'outcome',
    'policy',
    'reason_code',
    'matched_rules',
    'safe_to_show',
    'evaluated_at',
    'policy_decision_hash',
  ]);
  const enforcer = exact(decision.enforcer, ['type', 'id']);
  const policy = exact(decision.policy, ['id', 'version']);
  const decisionWithoutHash = { ...decision };
  delete decisionWithoutHash.policy_decision_hash;
  const receiptWithoutHash = { ...receipt };
  delete receiptWithoutHash.receipt_hash;
  let expectedDecisionHash: string;
  let expectedReceiptHash: string;
  try {
    expectedDecisionHash = hashPolicyDecision(
      decisionWithoutHash as Omit<PolicyDecision, 'policy_decision_hash'>,
    );
    expectedReceiptHash = receiptHash(
      receiptWithoutHash as Omit<ActionReceipt, 'receipt_hash'>,
    );
  } catch {
    throw new Error('invalid_receipt');
  }
  if (
    receipt.receipt_type !== expected.receiptType ||
    receipt.parent_receipt_hash !== expected.parentReceiptHash ||
    receipt.grant_id !== context.grant_id ||
    receipt.grant_hash !== context.grant_hash ||
    receipt.session_id !== context.session_id ||
    receipt.session_generation !== context.session_generation ||
    receipt.trace_id !== context.trace_id ||
    (expected.receiptType === 'runtime' &&
      receipt.span_id !== context.span_id) ||
    (expected.receiptType === 'app' && receipt.span_id === context.span_id) ||
    receipt.action_id !== context.action_id ||
    receipt.app_id !== context.app_id ||
    receipt.surface_version !== context.surface_version ||
    receipt.surface_hash !== context.surface_hash ||
    runtime.runtime_id !== context.runtime_id ||
    actor.agent_id !== context.agent_id ||
    actor.identity_evidence_hash !== context.identity_evidence_hash ||
    subject.user !== context.user ||
    receipt.idempotency_key !== context.idempotency_key ||
    receipt.input_hash !== context.input_hash ||
    execution.mode !== context.execution.mode ||
    execution.execution_id !== context.execution.execution_id ||
    receipt.execution_hash !== context.execution_hash ||
    (expected.receiptType === 'app' &&
      receipt.output_hash !== expected.outputHash) ||
    receipt.result !==
      (expected.receiptType === 'runtime'
        ? 'authorized_for_forwarding'
        : 'success') ||
    decision.type !== 'policy.decision' ||
    enforcer.type !==
      (expected.receiptType === 'runtime' ? 'runtime' : 'application') ||
    enforcer.id !==
      (expected.receiptType === 'runtime'
        ? context.runtime_id
        : context.app_id) ||
    decision.outcome !== 'allow' ||
    decision.reason_code !== 'policy_allowed' ||
    policy.id !==
      (expected.receiptType === 'runtime'
        ? 'calcu-runtime-admission'
        : 'calcu-app-admission') ||
    decision.evaluated_at !== receipt.timestamp ||
    receipt.policy_decision_hash !== expectedDecisionHash ||
    receipt.policy_decision_hash !== decision.policy_decision_hash ||
    receipt.receipt_hash !== expectedReceiptHash
  )
    throw new Error('invalid_receipt');
  if (
    typeof receipt.receipt_id !== 'string' ||
    !receipt.receipt_id.startsWith(`receipt_${expected.receiptType}_`) ||
    typeof receipt.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(receipt.timestamp)) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
      receipt.timestamp,
    ) ||
    typeof decision.decision_id !== 'string' ||
    !Array.isArray(decision.matched_rules) ||
    decision.matched_rules.some((rule) => typeof rule !== 'string') ||
    typeof decision.safe_to_show !== 'string' ||
    typeof policy.version !== 'string' ||
    execution.mode !== 'propose' ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.receipt_hash) ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.policy_decision_hash) ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.grant_hash) ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.surface_hash) ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.input_hash) ||
    !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.execution_hash) ||
    (expected.receiptType === 'app' &&
      (typeof expected.outputHash !== 'string' ||
        typeof receipt.output_hash !== 'string' ||
        !/^sha-256:[A-Za-z0-9_-]{43}$/.test(receipt.output_hash))) ||
    (expected.receiptType === 'runtime' && receipt.output_hash !== undefined) ||
    (expected.parentReceiptHash !== undefined &&
      !/^sha-256:[A-Za-z0-9_-]{43}$/.test(expected.parentReceiptHash)) ||
    !Number.isSafeInteger(receipt.session_generation) ||
    receipt.session_generation < 1 ||
    typeof execution.execution_id !== 'string'
  )
    throw new Error('invalid_receipt');
  return receipt as ActionReceipt;
}

export function verifyRuntimeReceipt(
  value: unknown,
  context: ReceiptContext,
): ActionReceipt {
  return verifyReceipt(value, { context, receiptType: 'runtime' });
}

export function verifyApplicationReceipt(
  value: unknown,
  expected: {
    context: ReceiptContext;
    parentReceiptHash: string;
    outputHash: string;
  },
): ActionReceipt {
  return verifyReceipt(value, {
    ...expected,
    receiptType: 'app',
  });
}

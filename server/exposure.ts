// Application-owned policy: these IDs are not an ASP-wide data taxonomy.
const content = 'calculation.content';
const context = 'calculation.runtime_context';
const status = 'calculation.status';

export function calculationDataClasses() {
  return [
    {
      id: content,
      classification: 'sensitive',
      label: 'Calculation content',
      description:
        'Operator, operands and computed result, including echoed values.',
    },
    {
      id: context,
      classification: 'sensitive',
      label: 'Runtime context',
      description:
        'Binding, correlation, execution and receipt metadata delivered to the runtime.',
    },
    {
      id: status,
      classification: 'private',
      label: 'Calculation status',
      description: 'Fixed protocol statuses and action identifiers.',
    },
  ];
}

export function calculationDataExposure() {
  return {
    classes: [content, context, status],
    redaction: { mode: 'none' },
    retention: { mode: 'user_managed' },
  };
}

type Rule = string | { readonly [key: string]: Rule } | readonly [Rule];
function fields(names: string, classification = context): Record<string, Rule> {
  return Object.fromEntries(
    names.split(' ').map((name) => [name, classification]),
  );
}

const execution = { mode: status, execution_id: context };
const subject = { user: context };
const receipt: Rule = {
  ...fields(
    'receipt_id receipt_hash parent_receipt_hash grant_id grant_hash session_id session_generation trace_id span_id app_id surface_version surface_hash idempotency_key input_hash execution_hash policy_decision_hash timestamp output_hash',
  ),
  receipt_type: status,
  action_id: status,
  result: status,
  runtime: { runtime_id: context },
  actor_agent: { agent_id: context, identity_evidence_hash: context },
  subject,
  execution,
  policy_decision: {
    ...fields('decision_id safe_to_show evaluated_at policy_decision_hash'),
    type: status,
    outcome: status,
    reason_code: status,
    enforcer: { type: status, id: context },
    policy: { id: context, version: context },
    matched_rules: [context],
  },
};
const response: Rule = {
  type: status,
  payload: {
    ...fields(
      'session_id session_generation grant_id grant_hash app_id surface_version surface_hash audience identity_evidence_hash trace_id span_id idempotency_key parent_receipt_hash input_hash execution_hash',
    ),
    subject,
    delegate: { runtime: context, agent: context },
    action_id: status,
    result: status,
    execution,
    output: fields('operator left right result', content),
    receipt,
  },
};

// Coverage complements schema/hash validation; it does not replace them or
// infer sensitivity from a value. Unknown fields fail before serialization.
export function calculationResponseCoverage(value: unknown) {
  const coverage: Record<string, string> = {};
  function visit(node: unknown, rule: Rule, path: string) {
    if (typeof rule === 'string') {
      if (
        node !== null &&
        typeof node !== 'string' &&
        typeof node !== 'boolean' &&
        !(typeof node === 'number' && Number.isFinite(node))
      ) {
        throw new Error('data_exposure_violation');
      }
      coverage[path] = rule;
      return;
    }
    if (Array.isArray(rule)) {
      if (!Array.isArray(node)) throw new Error('data_exposure_violation');
      node.forEach((item, index) => {
        visit(item, rule[0], `${path}/${index}`);
      });
      return;
    }
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error('data_exposure_violation');
    }
    for (const [key, item] of Object.entries(node)) {
      if (!Object.hasOwn(rule, key)) throw new Error('data_exposure_violation');
      visit(item, (rule as Record<string, Rule>)[key], `${path}/${key}`);
    }
  }
  visit(value, response, '');
  return coverage;
}

export function serializeCalculationResponse(value: unknown) {
  calculationResponseCoverage(value);
  return JSON.stringify(value);
}

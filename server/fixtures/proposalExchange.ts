// Private selected-envelope experiment. No production module imports this file.
// This owns representation/correlation only, never authority or receipt policy.
import { CanonicalObjectHash, JsonDocument } from '@0al/agent-surface';

type ProposalBinding = {
  session_id: string;
  session_generation: number;
  grant_id: string;
  grant_hash: string;
  app_id: string;
  surface_version: string;
  surface_hash: string;
  subject: { user: string };
  delegate: { runtime: string; agent: string };
  audience: string;
  identity_evidence_hash: string;
};

type InvocationContext<Action extends string> = ProposalBinding & {
  action_id: Action;
  trace_id: string;
  span_id: string;
  runtime_id: string;
  agent_id: string;
  user: string;
  idempotency_key: string;
  input_hash: string;
  execution: { mode: 'propose'; execution_id: string };
  execution_hash: string;
};

type ResultEvidence<Action extends string> = {
  context: InvocationContext<Action>;
  parentReceiptHash: string;
  outputHash: string;
};

const BINDING_FIELDS = [
  'session_id',
  'session_generation',
  'grant_id',
  'grant_hash',
  'app_id',
  'surface_version',
  'surface_hash',
  'subject',
  'delegate',
  'audience',
  'identity_evidence_hash',
] as const;
const HASH = /^sha-256:[A-Za-z0-9_-]{43}$/;
const HASH_ROOT = 'https://github.com/0al-spec/agent-surface/hash/';

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(code);
  return value as Record<string, unknown>;
}

function closed(value: unknown, fields: readonly string[], code: string) {
  const object = record(value, code);
  const keys = Object.keys(object);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  )
    throw new Error(code);
  return object;
}

function identifier(value: unknown, maximum = 256): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum)
    throw new Error('schema_invalid');
}

function digest(kind: string, value: unknown) {
  // Values are freshly parsed JSON or internally derived from those values.
  return new CanonicalObjectHash(`${HASH_ROOT}${kind}/v1`).digest(
    new JsonDocument(JSON.stringify(value)),
  );
}

export class ProposalExchange<Action extends string> {
  readonly #action: Action;
  readonly #draft: JsonDocument;
  readonly #requestLimit: number;
  readonly #responseLimit: number;

  constructor(
    action: Action,
    draft: JsonDocument,
    limits: { request: number; response: number },
  ) {
    this.#action = action;
    this.#draft = draft;
    this.#requestLimit = limits.request;
    this.#responseLimit = limits.response;
  }

  prepare(
    produceReceipt: (context: InvocationContext<Action>) => JsonDocument,
  ) {
    identifier(this.#action);
    for (const limit of [this.#requestLimit, this.#responseLimit])
      if (!Number.isSafeInteger(limit) || limit < 1)
        throw new Error('schema_invalid');
    const draft = closed(
      this.#draft.parse(this.#requestLimit),
      [
        'binding',
        'trace_id',
        'span_id',
        'idempotency_key',
        'execution',
        'input',
      ],
      'schema_invalid',
    );
    const binding = closed(draft.binding, BINDING_FIELDS, 'schema_invalid');
    for (const key of BINDING_FIELDS)
      if (!['session_generation', 'subject', 'delegate'].includes(key))
        identifier(binding[key]);
    for (const key of ['grant_hash', 'surface_hash', 'identity_evidence_hash'])
      if (!HASH.test(binding[key] as string)) throw new Error('schema_invalid');
    if (
      !Number.isSafeInteger(binding.session_generation) ||
      (binding.session_generation as number) < 1
    )
      throw new Error('schema_invalid');
    identifier(closed(binding.subject, ['user'], 'schema_invalid').user);
    const delegate = closed(
      binding.delegate,
      ['runtime', 'agent'],
      'schema_invalid',
    );
    identifier(delegate.runtime);
    identifier(delegate.agent);
    identifier(draft.idempotency_key, 128);
    identifier(draft.trace_id, 32);
    identifier(draft.span_id, 16);
    if (
      !/^[a-f0-9]{32}$/.test(draft.trace_id) ||
      /^0+$/.test(draft.trace_id) ||
      !/^[a-f0-9]{16}$/.test(draft.span_id) ||
      /^0+$/.test(draft.span_id)
    )
      throw new Error('schema_invalid');
    const execution = closed(
      draft.execution,
      ['mode', 'execution_id'],
      'schema_invalid',
    );
    if (execution.mode !== 'propose') throw new Error('schema_invalid');
    identifier(execution.execution_id, 128);
    const correlation = {
      ...binding,
      action_id: this.#action,
      trace_id: draft.trace_id,
      span_id: draft.span_id,
    };
    const context = new JsonDocument(
      JSON.stringify({
        ...correlation,
        runtime_id: delegate.runtime,
        agent_id: delegate.agent,
        user: (binding.subject as { user: string }).user,
        idempotency_key: draft.idempotency_key,
        input_hash: digest('action-input', draft.input),
        execution,
        execution_hash: digest('action-execution', execution),
      }),
    );
    // Each callback receives an owned copy. The saved expectations precede it.
    const receipt = record(
      produceReceipt(context.parse() as InvocationContext<Action>).parse(
        this.#requestLimit,
      ),
      'schema_invalid',
    );
    if (
      typeof receipt.receipt_hash !== 'string' ||
      !HASH.test(receipt.receipt_hash)
    )
      throw new Error('schema_invalid');
    const expected = context.parse() as InvocationContext<Action>;
    const request = JSON.stringify({
      type: 'action.request',
      payload: {
        ...correlation,
        idempotency_key: expected.idempotency_key,
        parent_receipt_hash: receipt.receipt_hash,
        runtime_receipt: receipt,
        input_hash: expected.input_hash,
        execution,
        execution_hash: expected.execution_hash,
        input: draft.input,
      },
    });
    if (new JsonDocument(request).utf8ByteLength() > this.#requestLimit)
      throw new Error('schema_invalid');
    return new PreparedProposalExchange<Action>(
      request,
      context,
      this.#responseLimit,
    );
  }
}

class PreparedProposalExchange<Action extends string> {
  readonly #request: string;
  readonly #context: JsonDocument;
  readonly #responseLimit: number;

  constructor(request: string, context: JsonDocument, responseLimit: number) {
    this.#request = request;
    this.#context = context;
    this.#responseLimit = responseLimit;
  }

  request(): string {
    return this.#request;
  }

  readResult<Result>(
    response: string,
    reader: (
      output: unknown,
      receipt: unknown,
      evidence: ResultEvidence<Action>,
    ) => Result,
  ): Result {
    let decoded: unknown;
    try {
      decoded = new JsonDocument(response).parse(this.#responseLimit);
    } catch {
      throw new Error('invalid_response');
    }
    const envelope = closed(decoded, ['type', 'payload'], 'schema_invalid');
    if (envelope.type !== 'action.result') throw new Error('invalid_response');
    const payload = closed(
      envelope.payload,
      [
        ...BINDING_FIELDS,
        'action_id',
        'trace_id',
        'span_id',
        'idempotency_key',
        'parent_receipt_hash',
        'input_hash',
        'execution',
        'execution_hash',
        'result',
        'output',
        'receipt',
      ],
      'schema_invalid',
    );
    const expected = (
      new JsonDocument(this.#request).parse() as {
        payload: Record<string, unknown>;
      }
    ).payload;
    for (const key of [
      ...BINDING_FIELDS,
      'action_id',
      'trace_id',
      'span_id',
      'idempotency_key',
      'parent_receipt_hash',
      'input_hash',
      'execution',
      'execution_hash',
    ]) {
      // Preserve Calcu's existing nested-object order behavior in this comparison.
      // This is not a generic ASP JSON-equivalence rule.
      if (JSON.stringify(payload[key]) !== JSON.stringify(expected[key]))
        throw new Error('invalid_response');
    }
    if (payload.result !== 'success') throw new Error('invalid_response');
    return reader(payload.output, payload.receipt, {
      context: this.#context.parse() as InvocationContext<Action>,
      parentReceiptHash: expected.parent_receipt_hash as string,
      outputHash: digest('action-output', payload.output),
    });
  }
}

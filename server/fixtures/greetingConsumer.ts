// Private second-consumer qualification, not an ASP receipt/authority profile.
import { randomBytes, randomUUID } from 'node:crypto';
import { JsonDocument } from '@0al/agent-surface';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Greeting, Greetings } from './greetingApp';
import { ProposalExchange } from './proposalExchange';

export const greetingSchema = Type.Object(
  {
    recipients: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
      minItems: 1,
      maxItems: 4,
    }),
    style: Type.Object(
      {
        prefix: Type.Union([Type.Literal('Hello'), Type.Literal('Welcome')]),
        punctuation: Type.Union([Type.Literal('!'), Type.Literal('.')]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const resultSchema = Type.Object(
  {
    messages: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), {
      minItems: 1,
      maxItems: 4,
    }),
  },
  { additionalProperties: false },
);

const evidenceSchema = Type.Object(
  {
    fixture_kind: Type.Literal('greeting-test-result'),
    parent_receipt_hash: Type.String(),
    input_hash: Type.String(),
    output_hash: Type.String(),
  },
  { additionalProperties: false },
);

// Opaque test parent marker only: not a signed or schema-valid Runtime Receipt.
// Its shape permits the generic mechanism to exercise its opaque receipt seam.
export const greetingParent = {
  fixture_kind: 'greeting-test-parent',
  receipt_hash: `sha-256:${'G'.repeat(43)}`,
} as const;

type GreetingTransport = (
  credential: string,
  request: string,
  signal?: AbortSignal,
) => Promise<string>;

export class GreetingConsumer {
  readonly #credential: string;
  readonly #binding: JsonDocument;
  readonly #transport: GreetingTransport;

  constructor(
    credential: string,
    binding: JsonDocument,
    transport: GreetingTransport,
  ) {
    this.#credential = credential;
    this.#binding = binding;
    this.#transport = transport;
  }

  async greet(value: unknown, signal?: AbortSignal): Promise<Greetings> {
    if (signal?.aborted) throw new Error('aborted');
    // Snapshot nested input before crossing any asynchronous or host callback.
    const input = new JsonDocument(JSON.stringify(value)).parse(8192);
    if (!Value.Check(greetingSchema, input)) throw new Error('schema_invalid');
    const selected: Greeting = input;
    const exchange = new ProposalExchange(
      'greeting.propose',
      new JsonDocument(
        JSON.stringify({
          binding: this.#binding.parse(),
          trace_id: randomBytes(16).toString('hex'),
          span_id: randomBytes(8).toString('hex'),
          idempotency_key: randomUUID(),
          execution: { mode: 'propose', execution_id: randomUUID() },
          input: selected,
        }),
      ),
      { request: 8192, response: 8192 },
    ).prepare(() => new JsonDocument(JSON.stringify(greetingParent)));
    const response = await this.#transport(
      this.#credential,
      exchange.request(),
      signal,
    );
    if (signal?.aborted) throw new Error('aborted');
    return exchange.readResult(response, (output, receipt, evidence) => {
      if (
        !Value.Check(resultSchema, output) ||
        output.messages.length !== selected.recipients.length
      )
        throw new Error('greeting_output_invalid');
      if (
        !Value.Check(evidenceSchema, receipt) ||
        receipt.parent_receipt_hash !== evidence.parentReceiptHash ||
        receipt.input_hash !== evidence.context.input_hash ||
        receipt.output_hash !== evidence.outputHash
      )
        throw new Error('greeting_evidence_invalid');
      // This checks selected evidence/correlation, not greeting semantics or
      // producer identity. The host owns execution and the returned text.
      return output;
    });
  }
}

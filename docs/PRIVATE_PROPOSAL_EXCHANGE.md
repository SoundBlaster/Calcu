# Private proposal request/result exchange

Status: private prototype and all local gates passed, 2026-10-02 UTC;
pending PR review/CI/merge. Tracked in
[P5-T10A](../SPECS/INPROGRESS/P5-T10A_Private_Proposal_Exchange.md).

## Question and selected contract

Can reusable request/result behavior reduce the Calcu integrator's work while
the real application still owns admission? The
[previous handler comparison](PRIVATE_HOST_BINDING_COMPARISON.md) removed no
integration code. This experiment instead targets the repeated envelope, hash
and correlation work in [LocalBackend](../server/localBackend.ts).

The normative reference remains the SDK source-lock revision
`da550fde6f8be4ff0c1ded15524afb66c2912287`:

- [Action Request and Action Response](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/core.md#action-request)
  distinguish transport authorization from body correlation and require the
  application to independently check current session and Grant/surface binding.
- [Canonical Object Hash Profile](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/evidence.md#canonical-object-hash-profile)
  defines the selected object hashing mechanism and domains.
- [Receipt Hash Chain](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/evidence.md#receipt-hash-chain)
  binds parent/child invocation context and separates hash integrity from
  producer authentication and authority.

The prototype supports the existing Calcu envelope for one non-persisted
`propose` action and a successful result. It is not a new ASP profile or a
complete Action Request/Response implementation. In particular, Calcu's extra
binding echoes and inline receipt fields are selected consumer behavior; this
experiment does not establish a portable extension declaration for them.

| Part | Exact private behavior | Owner / limit |
| --- | --- | --- |
| Binding | `session_id`, positive safe-integer `session_generation`, `grant_id`, `grant_hash`, `app_id`, `surface_version`, `surface_hash`, closed `subject.user`, closed `delegate.runtime/agent`, `audience`, `identity_evidence_hash` | Host supplies the selected snapshot; shape does not prove authority or freshness |
| Invocation | Host-selected `action_id`, nonzero lowercase 32/16-hex `trace_id`/`span_id`, bounded nonempty `idempotency_key`, closed `execution: { mode: "propose", execution_id }`, validated domain `input` | IDs/randomness, domain validation and action selection remain host-owned; no retry/deduplication engine |
| Hashes | Existing SDK `CanonicalObjectHash` and `JsonDocument`, using the exact `action-input/v1`, `action-execution/v1`, `action-output/v1` domains | No new JSON parser, normalization or hash profile |
| Request | Closed `type: "action.request"` / `payload`; binding + invocation + hashes + `runtime_receipt` + `parent_receipt_hash` | Host receipt producer receives its own context copy; the real executor validates the receipt independently |
| Response | Closed `type: "action.result"` / `payload`; repeated binding/correlation/hash fields + `result: "success"` + `output` + `receipt` | Compare to saved local request expectations before entering the host reader |
| Host reader | Receives decoded output, receipt and a fresh expected-context copy with parent/output hashes | Calcu validates echoed operands and finite result, verifies the App Receipt and retains it server-side |
| Limits | Explicit positive safe-integer byte limits; Calcu selects 8192 request/response bytes | Demo composition choice, not a universal ASP limit |
| Transport/error/cancellation | Existing HTTPS adapter sends credential outside JSON and verifies TLS; facade observes AbortSignal before send and after response | No transport, credential custody, lifecycle or cancellation policy in the representation mechanism |

The response's `span_id` echo and extra body fields are deliberately preserved
from Calcu. The app receipt still uses its own span as checked by the existing
receipt verifier. Do not generalize response-span equality to all ASP bindings.

For this comparison, nested binding/execution equality also retains Calcu's
existing JSON-property-order sensitivity. That is not an ASP JSON-equivalence
rule. A future portable contract must resolve it explicitly with compatibility
vectors; this experiment does not silently widen current acceptance.

## Composition and custody

The [private mechanism](../server/fixtures/proposalExchange.ts) imports only
existing SDK JSON/hash primitives. Constructors capture values. Explicit
`prepare()` parses a closed draft, validates supported representation, derives
hashes and snapshots expectations before invoking the host receipt producer.
The producer receives an owned copy. The finalized request is retained as text;
neither caller aliases nor later result-reader mutations can alter it.

`readResult()` parses bounded raw JSON, rejects duplicate members, verifies the
selected response shape and compares bindings to that saved request. It then
calls the explicit host reader with owned values. A correlated output is not
automatically an accepted application result: Calcu's domain and receipt checks
must succeed. Receipt construction/verification was not copied into the mechanism.
A receipt hash alone does not authenticate its producer.

The [test-only facade](../server/fixtures/proposalExchangeBackend.ts) retains:

- the one `calculationPropose` agent-facing method, local credential closure,
  selected binding, randomness and clock;
- validated/frozen copies of caller calculation inputs;
- current Runtime/App Receipt policy and server-only history;
- real authenticated transport, abort handling and domain output checks.

The live host still imports the production LocalBackend. Executor, source lock,
vendored SDK, surface version/hash, exposure policy, browser API/UI and model
settings are unchanged. No new public SDK export is introduced.

## Executable evidence

[Representation tests](../server/proposalExchange.test.ts) and
[paired HTTPS comparisons](../server/proposalExchangeComparison.test.ts) contain
126 passing targeted cases. The comparison uses the production executor,
ephemeral Ed25519 development identity, issued Grant/session, real loopback TLS
and current receipt/disclosure path. Certificates use owned temporary directories
and are disposed after the test file; no key is committed and certificate
verification is enabled.

| Scenario | Observed evidence |
| --- | --- |
| Production request reconstruction | Same selected IDs, input and host receipt reproduce the recorded request byte-for-byte; the candidate reads its actual HTTPS response |
| `multiply(240, 0.15)` | Both facades return `36`, record linked Runtime/App Receipts and enter the real engine once |
| Mutated request subject/delegate/generation/hashes/action/mode/input/receipt; credential added to body | Real executor rejects before engine entry |
| Revocation, rotation, retirement, identity status failure, deadline elapsed during verification | Both facades retain independent application rejection with zero entries |
| Changed response correlation/output/receipt/policy/output hash, extra fields, malformed/duplicate JSON, excessive bytes | Result rejected after one observed engine entry; no App Receipt accepted into the facade history |
| Earlier successful response returned for another invocation | Rejected; both actual executions remain charged; recreating a facade cannot reset quota |
| Caller edits and trusted clock/transport callback re-entry | Original input and host binding remain the request snapshot; caller objects are not frozen |
| Cancel before send | Zero receipts and engine entries |
| Cancel after real response arrives | No successful result/App Receipt presentation; one engine entry and consumed quota remain |
| Incorrect pinned CA | TLS failure before executor entry |
| Unsupported `sqrt` input | Calcu rejects before transport; no surface expansion |
| Division by zero | Existing HTTP `action_rejected` outcome after one engine entry |

The non-arithmetic greeting value in representation tests only demonstrates
that action IDs/input shapes are not hard-coded into the mechanism. It is not
a second live consumer, an independent implementation or interoperability proof.

## Cost and decision

Physical lines include comments, type declarations and blanks, under the same
repository formatter:

| Category | Observed cost |
| --- | --- |
| Production facade baseline | 169 lines in `server/localBackend.ts` |
| Candidate Calcu facade | 82 lines; 87 fewer (about 51%), including its own server receipt-history facility |
| Reusable private mechanism | 286 additional lines, including closed-boundary validation and types |
| Qualification tests | 728 additional lines across the two test files |
| Host setup / policy / executor | Unchanged; all current prerequisites and manual policy choices remain |
| Production migration | None; the running demo uses the original facade |

The prototype demonstrates reduced facade glue, not a smaller total repository:
82 + 286 is 199 lines more than the 169-line baseline before tests. It does not
justify claiming savings for another action/application without measuring that
consumer. The request/result mechanics have a more useful integration seam than
the previous one-line handler wrapper, but the cost must be amortized through
actual reuse.

**Decision:** continue to a bounded independent consumer / portable-contract
qualification. Keep this mechanism private. Before selecting public SDK API,
resolve the selected envelope/extension and JSON-equivalence rules, qualify a
non-Calcu consumer with its own schema/evidence policy, and verify packed-package
use and browser import boundaries. Independent authority/state validation stays
in each application. No RFC maturity or canonical ADP status changes here.

## Validation

- Targeted representation + real-HTTPS comparison: 126 tests passed.
- `npm run check`: formatting, lint, TypeScript, 469 Vitest tests, 6 preflight
  tests and 13 browser-bundle tests passed.
- `npm run build`: production UI built; browser bundle isolation passed.
- `npm run test:coverage`: 469 tests passed; 89.25% line coverage against the
  unchanged 80% gate. Fixture code is included by the existing coverage config;
  this percentage is not a production-readiness claim.
- `git diff --check` and local document-link checks passed. Pinned normative
  heading targets were checked against the source revision.
- No live Codex/provider request, production adoption or merge was performed.

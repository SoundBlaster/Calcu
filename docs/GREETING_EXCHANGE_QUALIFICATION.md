# Greeting consumer: private request/result reuse

Status: implemented and locally verified, 2026-10-02 UTC; pending PR/CI/merge.
Tracked by [P5-T10B](../SPECS/INPROGRESS/P5-T10B_Greeting_Exchange.md), stacked on
[Calcu #23](https://github.com/SoundBlaster/Calcu/pull/23), baseline `61da8f2`.

## Result and evidence boundary

The same private `ProposalExchange` serves both Calcu and a second small
Greeting consumer without inspecting either business action's input or output.
Greeting has its own nested-input/output schemas and result-evidence policy.
Its native application has no ASP dependency. No production code is migrated.

This proves **selected-envelope representation reuse across two data shapes**,
not two independent conforming ASP implementations. The second host runs over
real loopback HTTPS, but uses a deliberately synthetic lease and evidence:

- no full manifest/Grant issuance, identity verification or signature infrastructure;
- the `greeting-test-parent` marker is not a Runtime Receipt or a real digest;
- `greeting-test-result` is not an App Receipt; its parent/input/output checks
  exercise the explicit consumer policy callback, not RFC receipt conformance;
- hashes bind selected content, not the producer's identity. A party able to
  replace both content and fixture evidence can forge them. TLS and the trusted
  test composition, not these fixture hashes, authenticate the response channel;
- no live model, persistent side effect, retry engine or interoperability claim.

The existing SDK offline Hello consumer retains its original offline-only status.
This new fixture does not upgrade that consumer's evidence or RFC maturity.

## Scenario and ownership

```text
GreetingConsumer.greet({ recipients: ["Ada", "Grace"], style: ... })
  → shared private ProposalExchange
  → existing authenticated HTTPS transport
  → separate Greeting test host and synthetic lease
  → ordinary GreetingApp.greet()
  → Greeting output schema and fixture evidence policy
```

The [native app](../server/fixtures/greetingApp.ts) produces
`Welcome, Ada!` and `Welcome, Grace!`. The
[consumer](../server/fixtures/greetingConsumer.ts) owns closed schemas, credentials,
selected binding, IDs, transport/cancellation and evidence policy. It snapshots
nested input before calling transport and never invokes the native app itself.
It checks message shape/count and evidence, not natural-language meaning.

The [test host and vectors](../server/greetingExchange.test.ts) do not import
Calcu's math, executor, manifest, identity verifier or receipt policy. They share
only representation/hash primitives, existing transport and TLS/lifecycle test
infrastructure. A tiny independent lease checks revocation, generation, deadline
and a two-entry quota; it deliberately does not reproduce a complete ASP server.
The synthetic lease cannot establish production authority or credential-custody
properties. Handler entry and accepted presentation are counted separately.

## Explicit JSON compatibility correction

The pinned
[Canonical Object Hash Profile](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/evidence.md#canonical-object-hash-profile)
uses JCS object-member ordering while preserving array order and exact strings.
The private mechanism now uses the already-installed `canonicalize` dependency
to compare values **after** strict `JsonDocument` parsing. There is no new hash
domain, parser, default insertion, Unicode normalization or URI normalization.

| Response / input difference | Private candidate | Production LocalBackend |
| --- | --- | --- |
| Same delegate/execution values, different object-member order | Accept; ordinary receipt policy still required | Reject `invalid_response` |
| Changed or extra nested field; missing mode; changed URI case | Reject | Unchanged |
| Reordered recipient/message array | Different hash; fixture rejects stale hash/evidence | Not a Calcu input shape |
| Precomposed vs decomposed Unicode | Different string/hash; reject stale binding/evidence | No new normalization |

The paired real-Calcu HTTPS vector verifies the first row explicitly: both
paths enter the engine once, but only the candidate accepts the unchanged-value
response. Consequently this is **not blanket behavioral parity** with the
production facade. Request serialization/hashes and all existing lifecycle,
receipt, cancellation and quota vectors remain passing. Public adoption must
retain this compatibility decision, not reintroduce property-order equality.

## Negative evidence

- Invalid closed domain input: zero sends and zero native entries.
- Wrong/missing test credential, revoked/expired lease or stale generation:
  zero native entries; fixed error codes do not reflect credential data.
- Changed action, mode, input, array order, Unicode bytes, parent marker or
  credential in the body: rejected before the native method.
- Changed response correlation, output shape/count, array order or evidence:
  rejected after one observed native entry, not reported as zero execution.
- Earlier successful response reused for identical input: invocation mismatch;
  both actual entries still count. New consumer instances do not reset quota.
- Caller changes nested arrays/style or supplied binding after snapshot:
  saved expectations stay intact; caller objects are not frozen.
- Cancellation before send: zero entries. Cancellation after response: no
  accepted result, but the completed entry remains charged.
- Object-field reordering succeeds through actual HTTPS without changing hashes.

## Cost and decision

Physical lines include comments/types/blanks after the repository formatter:

| Item | Lines | Meaning |
| --- | ---: | --- |
| Shared private exchange | 287 | 286 at P5-T10A; one net additional line for JCS comparison |
| Existing candidate Calcu facade | 82 | Unchanged; production facade remains 169 lines |
| Native Greeting application | 17 | Business code, no protocol dependency |
| Greeting schemas/consumer/evidence policy | 118 | Application-specific integration; not hidden in generic mechanics |
| Greeting host + tests | 444 | Qualification infrastructure, not integrator boilerplate |

There is no hand-written Greeting baseline, so no percentage or total-code
savings claim is justified for it. Reuse is demonstrated, but this experiment
adds code to the repository. The P5-T10A cost/count evidence is frozen at its
own baseline in the [historical report](PRIVATE_PROPOSAL_EXCHANGE.md).

**Decision:** keep the mechanism private; the second-consumer and JSON-value
questions are now bounded and evidenced. Next write a small selected-envelope
compatibility decision: classify required correlation versus Calcu-only echoes,
settle how inline receipt fields are declared, and identify unsupported modes.
Do not invent an extension/profile identifier or publish an SDK API as part of
this qualification. After that decision, test the chosen API from packed SDK
consumers with import-boundary checks before considering a live Calcu migration.

## Validation

- 169 targeted representation, real-Calcu HTTPS and Greeting cases pass.
- `npm run check`: format/lint/typecheck, 512 Vitest, 6 preflight and 13 bundle
  tests pass.
- `npm run build`: UI build and browser bundle isolation pass; fixtures are not
  imported by production. Import-site inspection confirms test-only reachability.
- `npm run test:coverage`: 512 tests, 89.38% lines; the unchanged gate is 80%.
  Fixture coverage is included, not evidence of production readiness.
- Ephemeral TLS material and owned listeners are disposed by the tests. No
  private keys, raw authority or live-provider data are committed.
- Whitespace and changed-document local links are checked before commit.

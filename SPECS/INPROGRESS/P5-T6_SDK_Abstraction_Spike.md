# P5-T6: Validate SDK Abstractions with a Second Small Consumer

## Objective

Determine which parts of Calcu's ASP integration are genuinely reusable
TypeScript SDK behavior and which are facts of the Calcu application or its
deployment. Validate the current public SDK boundary in a second, intentionally
small application instead of generalizing from Calcu alone.

## Hypothesis

The merged SDK provides reusable, bounded offline behavior for strict JSON,
schemas, manifest representation, semantic Grant-request representation,
selected Grant representation, exposure projection, and canonical hashing.
It does not currently provide Calcu's live authority lifecycle or execution
boundary. A second consumer should be able to reuse the former without importing
Calcu or fictional SDK APIs.

## Selected second consumer

Use the existing native Hello application as the starting point. Its current
ASP composition file is explicitly design-only and imports nonexistent sketch
packages; it must remain labeled that way unless the spike replaces the fake
agent/runtime path with a small, honest consumer of the current locally packed
SDK artifact.

The consumer may exercise offline validation of its own manifest, schemas,
semantic request and selected Grant representation. Any identity and Grant
material is synthetic test data. It is not issued authority and must not enable
an action, start an agent, contact `.invalid` endpoints, or claim protocol
conformance.

## Reuse inventory to test

| Calcu concern | Initial classification | Evidence needed in P5-T6 |
| --- | --- | --- |
| `JsonDocument`, schema preparation, `SurfaceSnapshot`, manifest/request/selected-Grant validators | SDK reusable, representation-only | The Hello consumer imports the public package root and uses the same API successfully with its own IDs and schemas. |
| Hash views and receipt primitives | Candidate reusable behavior; exact ownership still needs comparison | Compare domains, self-field exclusions, serialization and receipt schemas; do not promote Calcu helpers automatically. |
| Identity artifact verification and lifecycle status | Application/deployment-owned trust input; a generic interface may be reusable later | Hello must not substitute an evidence string or digest for an actual verifier. P5-T6 does not claim identity verification. |
| User/principal and consent policy | Application-owned decision | Keep the demo out of synthetic authority issuance; document which approved inputs a future issuer would need. |
| Grant/session stores, revocation, quota, generation and concurrency | Unproven as a generic SDK engine | Identify required atomicity/fencing and crash/restart tests before extraction. A map or test fixture is not an adequate reusable state adapter. |
| HTTPS/TLS server and client | Deployment adapter candidate, not policy | Compare Calcu's concrete local TLS and framing assumptions; do not call same-host transport generic or production-ready. |
| Runtime mediator and action executor | Candidate shared orchestration, but must independently enforce both sides | No extraction until boundary/admission semantics, concurrency and transaction tests qualify it. |
| Math engine, four-operation surface, Codex CLI adapter, task UI and disclosure text | Calcu/provider/product-specific | Must remain in Calcu or an explicitly separate provider/UI package. |

## Work sequence

1. **Complete locally:** preserve the classification hypothesis and inspect
   exact public exports from the pinned package.
2. **Complete locally:** create a separately runnable Hello consumer which
   installs a packed SDK artifact and imports only `@0al/agent-surface` public
   exports.
3. **Complete locally:** add positive/negative tests for the supported offline
   values and explicit labels that checks do not authenticate or authorize.
4. **Complete locally:** measure consumer-specific code and document current
   API friction and limits in the [comparison report](P5-T6_Consumer_Comparison.md).
5. **Complete:** merge the focused SDK consumer PR, compare its locally packed
   merged-tree artifact with Calcu's pinned package, and revise the reuse
   inventory. The exported `dist/` and `spec-lock.json` match; package metadata
   differs only in development scripts. No runtime extraction is justified by
   this representation-only second consumer.

## Acceptance criteria

- The second consumer installs/builds against the package artifact, not SDK
  `src/` imports or test-only helpers.
- It needs no Calcu dependencies and no fictional `/sketch` exports.
- It demonstrates current SDK reuse for offline manifest/schema and
  request/Grant representation only.
- Negative fixtures fail closed without performing I/O or running application
  behavior.
- Its documentation explicitly says that identity trust, consent, credential
  issuance, session lifecycle, revocation, action admission, transport,
  execution, receipts' producer authenticity and ASP conformance are not proven
  by this spike unless separately implemented and tested.
- The resulting comparison distinguishes reusable SDK engineering from
  per-application integration work. No line-count target or abbreviated API may
  weaken an authority check.

## Stop conditions and non-goals

- Do not modify ASP normative text or the canonical ADP backlog in this Calcu
  task.
- Do not mark ADP-09 complete or unblocked; the ASP backlog remains its status
  authority.
- Do not extract Calcu's complete executor, Grant issuer, identity verifier,
  session records, quota state, TLS setup, task host, Codex adapter or UI by
  renaming them as generic SDK services.
- Do not add public API based only on the design sketches in
  `agent-surface-js/docs/api-design-principles.md` or
  `examples/design/hello-composition/`.
- If a second consumer requires a new runtime contract, stop after recording the
  gap and propose the smallest separately reviewable SDK slice before coding it.

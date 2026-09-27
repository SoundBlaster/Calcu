# P5-T7: Offline Action Authoring — Design Proposal

**Status:** Design proposal with a bounded acceptance-spike result; no SDK API or implementation is approved by this document.
**Owner:** Calcu adoption spike; any SDK change remains a separate reviewed deliverable.
**Depends on:** P5-T5 and P5-T6.

## 1. Purpose

P5-T6 demonstrated that the current TypeScript SDK can validate offline ASP
representations in both Calcu and a small Hello consumer. It also showed that
application-owned IDs, schemas, classifications and representation wiring are
still repeated by each consumer. P5-T7 will determine whether a small,
application-first authoring layer can reduce that duplication without hiding
policy, changing ASP wire semantics or claiming runtime authority.

This is an ergonomics and representation-generation investigation. It is not a
proposal to make applications ASP-centric: a native application must remain
useful without ASP, and ASP integration should be an optional composition.

## 2. Question and hypothesis

**Question:** Can one explicit operation declaration describe an existing
application capability once, then produce the same supported offline ASP action
and schema representations that consumers currently assemble manually?

**Hypothesis:** A small declarative authoring model can reduce repeated
representation plumbing if it derives only validated schemas and manifest
fragments, while requiring application authors to state all security-relevant
metadata and handler bindings explicitly.

The experiment must be allowed to conclude that the abstraction is not worth
its one-time SDK implementation and maintenance cost.

## 3. Candidate authoring model

Evaluate an inert, typed operation declaration containing these conceptual
parts:

| Part | Ownership and requirement |
| --- | --- |
| Stable ASP action ID | Explicit application-owned wire identifier. |
| Execution mode and side-effect declaration | Explicit; never inferred from function names, return types or annotations. |
| Closed input and output models | One runtime-validatable source of truth that can supply TypeScript types and JSON Schema; exact supported schema constraints remain mandatory. |
| Explicit data-exposure and risk/effect metadata | Application-authored policy; no classification inferred from TypeScript types, names or descriptions. |
| Handler binding | Explicit reference to an application-owned function/object. Never discover or export arbitrary public methods. Handler code is not serialized into the manifest. |
| Resource/schema references | Stable, checked references derived from the declaration or explicitly supplied; dangling or conflicting references fail preparation. |

The concrete TypeScript syntax and schema library are intentionally undecided.
The design should compare the existing SDK's supported JSON Schema boundary with
the proposed authoring shape before selecting either. Avoid maintaining a
TypeScript interface and a separately handwritten JSON Schema for the same
payload unless the experiment demonstrates a safe consistency check.

Construction should be inert. An explicit preparation step should reject
invalid or unsupported declarations before a host starts. This layer may derive
offline schemas and action/resource manifest fragments, but it must not issue,
select or modify a Grant.

## 4. Consumers and comparison method

Use the two existing consumers as different-shaped examples:

1. **Hello:** a fixed-output, inert `greeting.propose` representation. It has no
   live authority, agent, transport, runtime or executable ASP action. Its role
   is to test whether the authoring shape remains natural for a tiny optional
   integration.
2. **Calcu:** the existing `calculation.propose` proposal action with its
   closed `operator`, `left` and `right` input, exact output shape, and explicit
   exposure/effect declarations. Its native math behavior remains application
   code behind the current trusted executor boundary.

For each consumer, compare the manual baseline with the experimental
declaration and derived artifacts. Record separately:

- per-operation declarations and wiring;
- consumer setup and composition steps;
- explicit policy decisions still made by the application author;
- tests and negative cases required;
- one-time SDK implementation and maintenance cost;
- generated artifact size/shape and validation behavior.

Do not use raw line count as the success metric. Report whether policy decisions
became clearer, stayed explicit, or were accidentally obscured.

## 5. Authority and semantic boundaries

The authoring layer must preserve these invariants:

- A declaration or generated manifest is a description, not authority, consent,
  identity evidence, authentication, proof of intent or ASP conformance.
- Adding an operation must not silently enlarge the allowed action/scope set in
  any Grant. Grant and session validation remain separate and independently
  enforced.
- Data exposure, risk/effects, execution mode, side-effect status and handler
  allow-list are explicit inputs; no security property is guessed from code
  shape, identifiers, comments or LLM output.
- Generated JSON must preserve exact supported ASP wire field names and be
  accepted by the existing offline validators. No alternate wire vocabulary.
- Preparation validates declarations but does not run handlers, perform I/O,
  start a listener, or acquire credentials.
- The handler stays application-owned and is invoked only by the existing
  trusted execution path after admission. The authoring API must not create a
  direct agent-to-handler bypass.
- Agent/provider selection, prompts, model profiles and agent planning remain
  outside the provider-neutral ASP SDK core.
- This work does not revise ASP normative text or change the canonical adoption
  backlog/status.

## 6. Required prototype evidence, if separately authorized

If this design is accepted for implementation, the follow-up prototype should
remain offline and consumer-scoped until its generated representation passes
the current validators. It should produce no network traffic and execute no
handler. Required evidence:

1. Canonical/generated comparison for the supported action and schema fragments
   in both consumers, with deliberate, reviewed differences called out.
2. Positive validation through the package root exports from a packed SDK
   artifact, not source or test-only imports.
3. Negative tests for at least:
   - duplicate action IDs;
   - missing required explicit metadata;
   - open input/output schemas or unsupported schema keywords;
   - dangling/conflicting schema references;
   - declaration/type/schema mismatch;
   - ambiguous or missing handler binding;
   - attempts to auto-register undeclared methods;
   - attempts to expand a Grant's actions/scopes by adding a declaration.
4. An inertness test proving declaration/preparation performs no handler calls,
   I/O, transport startup or credential access.
5. Re-run both consumer examples and their existing negative checks; report
   changes in app effort and SDK complexity separately.

The exact artifact comparison strategy (deep semantic equality versus canonical
byte equality) must be chosen against the current hash/wire contract before
coding. Do not assume byte identity where ordering or canonicalization is not
normative.

## 7. Out of scope

P5-T7 does not implement or generalize:

- Grant issuance/selection, identity verification, consent or principal policy;
- session stores, revocation, quotas, transactional admission or fencing;
- executor, mediator, event delivery or bidirectional agent runtime;
- Runtime/App Receipt production, signing or verification;
- HTTP/TLS transports, Codex adapters, UI or process supervision;
- arbitrary TypeScript reflection, decorator magic or automatic method export;
- platform-specific Swift/Rust/Go authoring APIs;
- new normative ASP requirements, conformance claims or ADP backlog completion.

These may be considered only as separately scoped work after evidence from more
than one live implementation establishes a reusable contract.

## 8. Decision gates and success criteria

The design phase is complete when reviewers can answer, with evidence and
explicit open questions:

1. Which repeated consumer declarations are true mechanical duplication, and
   which are necessarily app policy?
2. What is the single runtime-validatable source of truth for input/output
   shape, and how are TypeScript types derived without casts or drift?
3. Which exact existing offline representations may be derived, and which must
   remain explicit or application-owned?
4. How does adding an operation remain independent from Grant authority?
5. What negative tests establish closed schemas, explicit metadata, inertness
   and handler allow-listing?
6. Does the reduction in per-consumer plumbing justify SDK implementation,
   support and compatibility cost?

Proceed to a prototype only if the answer to the final question is positive and
the previous boundaries have a testable design. Otherwise record the negative
result and keep the current explicit representation APIs.

### Design recommendation

Keep the authoring layer private and experimental. The Calcu spike establishes
that its action/schema fragment can be composed into a complete existing
manifest and accepted by Calcu's pinned validators, but it does not establish
byte/hash equivalence or enough whole-manifest authoring reduction for
production adoption. Do not add package-root exports, a public API promise, or
change Calcu's live execution path on this evidence alone.

## 9. Open questions

- Should authoring start from a schema-first builder, a runtime schema object
  with inferred static types, or a small closed descriptor format?
- Can the current SDK schema support cover both consumers without a second
  schema DSL or a dependency whose maintenance outweighs the benefit?
- Which pieces of the ASP manifest are intrinsic to an action, and which belong
  to surface-level application policy that should not be copied per operation?
- Is handler association needed in the first offline prototype, or should the
  first slice generate representation only and test allow-list binding
  separately?
- What compatibility/versioning promise, if any, is justified before a second
  independent live runtime uses the authoring layer?

These remain open; the examples in SDK design guidance are not approved API
signatures.

## 10. Calcu acceptance-spike evidence (2026-09-27)

The bounded local spike uses the reachable Calcu main baseline commit
`a628c252986882d4e9f3734c560238ce38207596` and the private action-authoring
prototype at agent-surface-js commit
`03fd21c8bca70968b08e4585c14d1f6971978797`. It imports the real Calcu
`calculate` handler reference but only binds it; a Proxy call counter remained
zero. No executor, Grant, identity, transport, app handler behavior, SDK
package-root export, or production manifest composition was changed.
The full-manifest validators are Calcu's installed package artifact from
agent-surface-js merge commit
`4cd339796eb43eb9e6a15c934a23b20e9a3ec434`; generator and validator revisions
are recorded separately.

The test obtains `prepareCalcuSurface()` and its exact existing event/receipt
schema resources, prepares the prototype fragment, remaps its fixture schema
base to the real Calcu issuer, recomputes the input-schema hash, then replaces
only the action and input/output schema resources in a candidate clone. The
candidate passes both `SurfaceSnapshot` and the installed Calcu
`OfflineProposalManifest` validator. Non-action manifest fields, scopes, and
the event/receipt resources compare equal to the baseline; valid input/output
payloads pass and an extra input property is rejected. `PreparedCalcuSurface`
now exposes a readonly, frozen resource-array reference solely so this test can
reuse the actual baseline receipt/event schemas rather than copy them. Existing
callers ignore the additive field; executor and prepared validator behavior is
unchanged.

The action object matches exactly except for `input_schema_hash`. The schemas'
payload shape is equal after removing the prototype's redundant
`properties.operator.type: "string"`; the manual Calcu schema declares only
`enum`. Since the input hash commits the schema document (including URI and
shape), the representation difference changes both input hash and full surface
hash. The spike therefore passes semantic schema validation, but does not claim
wire/hash equality or authorize substituting the generated hash into existing
Grants.

| Comparison | Existing Calcu | Candidate | Result |
| --- | --- | --- | --- |
| Input schema hash | `sha-256:hBlOPfEMLb7xbIk8EUNQQy5cOo9xZ-aE92TSIp8-YlY` | `sha-256:RjICwvHoNxNlNu4qIDqYyU6tZzh5_dFrsbMSrFLDBs4` | Differs due to redundant operator type |
| Surface hash | `sha-256:Qj0u69XElULRh6JPS5pUe0RQ9q0EOwpjpeJ8uyDXcIA` | `sha-256:AECpKHf3xtz8-F3P7VFAKvjJoemccB-rw82KrCZxuig` | Differs transitively |
| Bound handler calls during preparation | 0 | 0 | Inert |

### Authoring-effort accounting

LOC here means physical nonblank source lines in the pinned Calcu baseline,
including braces and punctuation; this is a bounded accounting of relevant
source blocks, not the success metric. The manually authored URI declarations
(2 lines), input/output schema literals (21), input/output resource entries
(2), and action object (20) total 45 lines. Those are the direct
action-specific manifest blocks replaced in the candidate. The prototype's
Calcu declaration is 67 nonblank, non-comment lines including its explicit
TypeBox models, action policy, handler binding, data-class catalog, and catalog
setup. This is a representation change, not a net LOC reduction: data exposure
and data-class policy remain explicit, while the full envelope still needs
app-specific composition.

The candidate keeps all other manifest declarations: protocol/version/issuer,
identity profile advertisement, auth and agent API URLs/event delivery,
scope descriptions, data-class catalog, revocation, and the control event and
receipt schema/requirements. In particular, the large receipt schema and
control event are not generated by the prototype. The local acceptance test is
272 physical lines (254 nonblank/non-comment) and the reproducibility runner is
66 physical lines (60 nonblank/non-comment), mostly to pin the external source,
adapt fixture URIs, prove full-manifest preservation, and report precise
differences. This is worthwhile evidence for a private spike, but not a
production authoring simplification for Calcu's single action. Reconsider only
if another independent action or consumer shows repeated savings that amortize
this adapter and the SDK maintenance surface.

### Reproduction and limitation

On a clean Calcu checkout with dependencies installed and the pinned clean SDK
checkout available, run from the Calcu root:

```sh
AGENT_SURFACE_JS_ROOT=../0AL/agent-surface-js npm run test:action-authoring-spike
```

The runner verifies the SDK commit and tracked clean state, builds the base SDK
and experimental TypeScript output from that source via
`npm run build:action-authoring-prototype`, then runs only the targeted Calcu
test. For a fresh checkout at the pinned commit, install its locked dependencies
with `npm ci`; the runner performs the build itself. It intentionally does not
clone or mutate another checkout.
The test is skipped during ordinary Vitest discovery unless the dedicated
runner sets its private opt-in marker; the dedicated command fails clearly if
the SDK-root environment variable is absent, the commit differs, the tracked
or ordinary untracked tree is dirty, or the SDK build fails. This is a
repeatable manual cross-repository spike, not a durable cross-repo CI gate or
live synchronization mechanism; it uses no copied manifest fixture or vendored
generated SDK artifact.

---
**Archived:** 2026-09-28
**Verdict:** PASS — bounded offline acceptance spike; no-go for production adoption on single-action evidence.

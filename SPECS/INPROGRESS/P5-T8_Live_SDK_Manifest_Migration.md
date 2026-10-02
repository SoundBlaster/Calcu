# P5-T8 — Migrate the live manifest to SDK authoring

Status: P5-T8A merged and P5-T8B implemented for review, 2026-10-02 UTC.
P5-T8A preparation is implemented; see
[snapshot/fixture evidence](../../docs/LIVE_SDK_MANIFEST_PREPARATION.md).
P5-T8B selects the SDK snapshot; see
[activation and lifecycle evidence](../../docs/LIVE_SDK_MANIFEST_ACTIVATION.md).
Priority: P1. Complexity: high; reasoning effort: high.
Dependencies: P5-T5/P5-T7 evidence, merged
[SDK #32](https://github.com/0al-spec/agent-surface-js/pull/32) and
[Calcu #16](https://github.com/SoundBlaster/Calcu/pull/16).

## Objective and user scenario

Use the qualified `OfflineActionInventory` declaration to prepare the actual
Calcu manifest and its input/output schemas. Keep one application-owned
description of the four-operation proposal. The complete host manifest still
supplies identity, authorization, scopes, events, receipts and revocation data.

A user reviews access and runs “What is 15% of 240?”. The host issues authority
for the SDK-authored snapshot, Codex calls `calculation_propose`, and the existing
HTTPS executor admits `multiply(240, 0.15)` before Calcu returns `36`. Runtime
and App Receipts bind to that same snapshot. The UI continues to distinguish
the executed operation from the meaning of the user's natural-language task.

If the host is replaced between access review and Run, the old cookie, offer or
Grant cannot carry forward. The user reconnects to the new host and reviews
access again. An operation already executed before shutdown is not undone.

## Evidence and selected compatibility policy

The [offline migration report](../../docs/OFFLINE_ACTION_AUTHORING.md) proves
that the public module preserves the private prototype's two-namespace
candidate hashes and schemas. Compared with the handwritten live schema, it
adds `type: string` to the existing string operator enum. Accepted calculation
values remain the same, but the input-schema and surface hashes differ.

The SDK remains pinned to ASP `da550fde6f8be4ff0c1ded15524afb66c2912287`.
The pinned [Surface Hash](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/core.md#surface-hash)
and [Versioning and Compatibility](https://github.com/0al-spec/agent-surface/blob/da550fde6f8be4ff0c1ded15524afb66c2912287/drafts/modules/core.md#versioning-and-compatibility)
rules require a new version when the manifest hashing view changes and prohibit
interpreting an old Grant against a replacement snapshot. Version labels are
opaque: compare equality, never infer authority from version ordering.

The first deployment transition uses **stop and restart, retiring old authority**.
Calcu currently has one in-memory executor per host, ephemeral identity/TLS and
process-session cookie, per-task Grants valid for at most 60 seconds, and
revocation in the task's `finally` block. Supporting simultaneous old/new live
snapshots would add a second lifecycle without a current consumer requirement.

| Binding | Historical live value | Selected live value |
| --- | --- | --- |
| `surface_version` | `0.1.1` | `0.1.2` (new opaque label) |
| Action schema namespace | `<issuer>/schemas/` | `<issuer>/schemas/0.1.2/` |
| Action/scope | `calculation.propose` | `calculation.propose` |
| Execution/effects | `propose`, `persisted: false`, `side_effect: false` | Same declarations |
| Disclosure | Application-owned classes and `user_managed` retention | Same declarations |
| Grant migration | Current exact snapshot | Retire old Grants; require fresh access selection and issuance |

Only the two action schema URIs change; existing event/receipt resources keep
their exact content and URIs. Preserve the old manifest and all old resource
bytes as test/audit fixtures. Never replace schema contents under an existing
URI. These are local immutable resolver identifiers: Calcu currently serves
neither a manifest discovery endpoint nor schema GET endpoints, and this task
does not add those services.

## Implementation invariants

1. Prepare and validate the entire new snapshot before listening or issuing
   authority. SDK fragments enter `OfflineProposalManifest` with the complete
   host fields and resource set. Invalid preparation prevents startup.
2. Trusted host composition selects the prepared snapshot. Browser payloads,
   model/tool arguments and environment input cannot select its version, schema
   namespace or alternative action. Any app-id/issuer options must match the
   prepared snapshot supplied to the executor.
3. The permission broker, issuance, executor schema validation and receipt
   contexts use the same prepared snapshot. Check the existing module-level
   `surface` imports in `demo.ts`/`localBackend.ts` when changing composition;
   eliminate any independent source of a version/hash binding. Fixed action and
   mode remain application-owned and are checked against the selected snapshot.
4. Authoring captures only schemas and explicit metadata. `calculate`, numeric
   business checks, independent admission, quotas and receipt verification remain
   on the existing execution path. Registration or preparation issues no Grant.
5. An executor retired by the trusted host stops issuance and revokes every
   active Grant/session it owns. Subsequent calls through even a retained
   executor reference fail before a new engine call. No record is rewritten to
   the new version/hash; recreating a mediator does not reset its quota.
6. Old credentials sent to a new executor are `unauthorized`; a new credential
   paired with an old binding fails `binding_mismatch`. Preserve the existing
   error mappings and avoid translating retired authority into a fresh Grant.
7. Browser access selection remains bound to the reviewed task and current
   surface. Failed/stale selection requires a fresh review. Credentials, Grant
   and raw receipt objects remain server-side.

## Delivery in two focused PRs

### P5-T8A — Prepare the live candidate and preserve the old baseline

Input: merged public offline candidate, existing host manifest builder, pinned
two-namespace goldens and application-owned exposure policy.

- Extract the one supported declaration into a server-only module shared by
  offline comparison and the new live snapshot factory. No handler parameter.
- Create immutable legacy fixtures before removing handwritten action/schema
  duplication. Preserve both old live hashes and the accepted prototype-candidate
  goldens; make the comparison test read the fixed legacy baseline.
- Prepare a complete version `0.1.2` snapshot at the versioned action namespace.
  Supply unchanged host/event/receipt/identity fields explicitly. Pin its exact
  new manifest/resource digests at both existing issuer namespaces.
- Validate compile-time input/output correspondence and all four operators.
  Keep the old live factory selected until P5-T8B activates the new one.
- Add TypeBox `0.34.52` as an explicit runtime dependency when the new server
  module uses `Type.*`; update the lockfile without other dependency upgrades.

Output: a qualified server-only snapshot factory, shared declaration and fixed
legacy comparison fixtures. Verify URI immutability, the exact known schema
delta, whole-manifest validation and zero preparation-time application calls.

### P5-T8B — Activate the snapshot and qualify host replacement

Depends on P5-T8A; do not land activation with incomplete preparation evidence.

- Prepare the selected snapshot once in trusted composition and pass its
  bindings to the permission/issuer/executor path. Switch the default live
  manifest to the qualified `0.1.2` snapshot and remove handwritten action/schema
  blocks from the live builder.
- Add the smallest Calcu-owned retirement/shutdown behavior needed by the demo.
  First stop accepting tasks and issuing offers/Grants, then retire the executor
  and cancel the active adapter. Close incomplete inbound requests immediately:
  aborting the task controller alone does not interrupt a stalled body reader.
  Await adapter cleanup/issuance callback finalization, close both listeners and
  owned connections, and dispose owned TLS material.
- Use one shared five-second shutdown deadline, not sequential timeout budgets.
  It covers inbound body readers, task finalization, adapter TERM/KILL cleanup,
  outbound transport and listener/socket closure. Force-close remaining owned
  connections by the deadline. If child cleanup cannot be confirmed, report
  failure and terminate the old demo process; replacement stays blocked until
  the old host and its owned agent process have demonstrably exited.
- Start the replacement only after the old host has stopped. The new process
  creates fresh session cookie, identity, TLS and per-task authority. Require a
  new browser connection and access review; reject an old offer on the new host.
- A failed new snapshot preparation leaves the new host unstarted. Recovery
  restarts a reviewed artifact as a fresh host with fresh authority. Returning
  to old code never restores an old cookie, Grant, session or permission offer.

Output: SDK-authored live description with deterministic fake-agent/HTTPS
evidence, retirement/restart tests, updated adoption and conformance reports.
There is no in-process snapshot swap or automatic retry across host generations.

## Acceptance scenarios and test-first sequence

Write transition characterization tests before changing live selection. Reuse
the current boundary/HTTPS/task-host/fake app-server fixtures; add a focused
host-lifecycle test only where existing fixtures cannot observe cleanup order.
For cancellation/retirement, use a valid credential, request binding and Runtime
Receipt with an observable barrier before admission. Release the delayed request
after retirement and assert no additional engine call. The existing transport
abort/timeout example sends `{}`, which already fails schema admission; it cannot
alone demonstrate that cancellation stopped an otherwise admissible operation.
Use a separate post-execution response barrier to observe the already-performed
call when a response is delayed, cancelled or mismatched.

| Scenario | Required observation |
| --- | --- |
| New snapshot at both namespaces | Exact new schema URIs, version and golden hashes; old fixture bytes/digests unchanged |
| Invalid authoring/host resource composition | Startup fails before listening, Grant issuance or engine calls |
| Permission → new Grant → HTTPS → engine | Exact new version/hash throughout; `240 × 0.15 = 36`; one engine call; valid linked server-side receipts |
| Four operations and raw invalid JSON | Existing accepted shapes retained; `sqrt`, extra/missing fields, duplicate keys, `-0` and overflowing input reject |
| Retirement with outstanding permission | New offers/issuance stopped; stale permit cannot issue authority; old offer/cookie cannot run on replacement |
| Old Grant after retirement/restart | Old executor references and new listener reject; engine-call counter unchanged for each rejected request |
| Mixed old/new binding or receipt | Exact mismatch rejection; no admission-time engine call for forged request/Runtime Receipt |
| Active task during shutdown | Adapter process group terminates; task finalization revokes authority; listeners and TLS resources close; replacement does not accept late events |
| Partial/stalled HTTP body during shutdown | With valid Host/Origin/cookie and a valid declared body length, send only a body prefix; no Grant issuance or engine call; owned connection closes within the shared deadline; replacement stays blocked until retirement and process cleanup complete |
| Operation completed before shutdown | Historical result/receipt retains its old tuple; no automatic replay or reassignment to the new task |
| Forged/mismatched App Receipt | LocalBackend rejects the returned result; assert no success, not zero engine calls after execution |
| Retry on replacement | User reconnects and reviews access; new task/Grant/session/correlation bindings; no old authority reuse |
| Native calculator and browser build | Existing keypad/UI behavior and server-artifact isolation pass |

Deterministic fake Codex → real loopback HTTPS is the CI integration gate.
An optional manual `npm run agent:demo` smoke can check the installed authenticated
CLI after implementation; record it separately from CI and fixture evidence.

Run `npm run check`, `npm run build`, `npm run test:coverage` and
`git diff --check` for each implementation slice. Check a clean `npm ci` after
dependency changes. Preserve the 80% line coverage gate and UTC evidence dates.
Do not repeatedly run unchanged gates or wait by polling CI.

## Definition of done and reporting

- Live action/schema fields have one authoring source; full host policy remains
  explicit and the one-action complete-manifest contract still validates.
- Exact new version/hash/resources are pinned end-to-end. Old resources are
  retained immutably as evidence and retired authority cannot be reinterpreted.
- Startup, retirement, cancellation, replacement and recovery tests pass with
  explicit observations at admission versus after execution.
- Record action/declaration lines, host-composition lines and setup steps before
  and after migration. Report the measured change; set no arbitrary reduction
  target and do not count legacy test fixtures as live authoring duplication.
- Update `server/README.md`, `server/CONFORMANCE.md`, `server/TASK_PERMISSIONS.md`,
  the adoption/offline reports, vendor provenance and the workplan/next queue.

The SDK source lock, ASP normative text, four-operation tool surface and
Compatibility Bearer development profile remain the selected contract. Durable
state, dual live snapshots, schema-serving endpoints, signed receipts, Human
Approval, Proof-Bound transport and general SDK executor/store extraction are
separate follow-ups. The plan itself granted no authority. P5-T8B implements the
bounded transition; its report separates fixture evidence from provider smoke.

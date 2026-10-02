# P5-T8B — SDK-authored live manifest and bounded retirement

Status: implemented for review, 2026-10-02 UTC. The default live selection is
`0.1.2`; P5-T8A was merged in [Calcu #18](https://github.com/SoundBlaster/Calcu/pull/18).
This is still the Compatibility Bearer loopback-HTTPS development profile.
ASP normative text, SDK package/source lock and tool surface are unchanged.
The UI follow-up adds public `surface_version` to the permission-offer response;
the run request and NDJSON event contract remain unchanged. No production
certification or natural-language intent claim is made.

## What changes for a user

Review access, then run “What is 15% of 240?”. The SDK describes the one
`calculation.propose` action; Calcu issues its authority and independently checks
the exact admitted `multiply(240, 0.15)` before returning `36`. The task panel
still separates the requested task, verified application action and unverified
agent prose. It does not infer that the agent understood every natural-language
request or add `sqrt`.

The initially collapsed **ASP details** block displays the server-selected
surface version and existing allowed action. Its version is validated as a
bounded opaque label, not hardcoded in the UI. These public fields remain with
the submitted task's result and are replaced on fresh review; failure or
cancellation hides them. Grant, credentials and identity artifacts remain
server-only. This projection does not itself authorize execution.

If the demo stops between Review and Run, that access selection ends. A fresh
host has a new identity, TLS material, cookie, offers, Grants and sessions. The
user reconnects and reviews again. The host does not replay the old task. A
calculation executed before shutdown remains executed; cancellation of its
response is not an undo.

## One description, one trusted selection

[`calculation-declaration.ts`](../server/calculation-declaration.ts) supplies
closed four-operation schemas and explicit action/exposure metadata through
`OfflineActionInventory`. [`manifest.ts`](../server/manifest.ts) supplies the
complete host policy and validates the full document. The handwritten legacy
action/schema branch is removed. Action schemas are at
`<issuer>/schemas/0.1.2/`; event/receipt schema bytes and URIs remain unchanged.

Both factories select the qualified `0.1.2` description. The default module
snapshot is prepared once; [`demoHost.ts`](../server/demoHost.ts) passes the same
object to permissions and the executor. Custom namespace composition is a
trusted server-only seam, not browser/model configuration. Executor construction
checks app/issuer and the exact document/surface/hash/audience tuple. LocalBackend
uses fixed application action/mode identifiers and copies the issuer's
version/hash/session binding. Receipt contexts use that binding.

The [P5-T8A report](LIVE_SDK_MANIFEST_PREPARATION.md) retains the qualified exact
hashes/digests at both namespaces. Immutable `0.1.1` fixtures and historical
offline goldens remain unchanged. Old schema contents are not overwritten,
and Calcu still serves no manifest/schema discovery GET endpoints. Registration
and authoring alone issue no Grant and accept no business handler.

## Retirement and ownership

`shutdown()` immediately retires the executor and permission broker before any
await: every owned Grant/session is revoked, retained issuer/executor references
reject, and outstanding or accepted-but-unclaimed permissions cannot be claimed.
The host stops accepting requests, aborts the active task and closes partial
body readers. Both listeners and only their owned sockets are closed, including
pending HTTPS transport. Finalization still runs the task's Grant revocation.

One five-second deadline covers task finalization, child cleanup, transport,
listeners, sockets and TLS disposal. Connections are destroyed immediately on
retirement, not left for a stalled peer to release. Shutdown is idempotent. A
deadline or unconfirmed cleanup rejects `demo_shutdown_failed`; the CLI exits
unsuccessfully and does not start a replacement. The library's failure promise
allows trusted callers to observe unsolicited cleanup failure. A replacement
must only be started after confirmed shutdown/exit; there is no migration API.

The Codex adapter now preserves Node's internal stream-close listeners, waits
for actual child close and disappearance of its owned POSIX process group,
sends TERM then KILL, and rejects `agent_cleanup_failed` if confirmation is not
obtained. Cancellation is rechecked after version verification and temporary
directory creation, preventing late app-server spawn. In-flight tool handling
finishes before adapter completion. No unrelated process or cache is touched.

Preparation fails before listeners/issuance. A TLS/listener startup failure
disposes owned resources. Recovery means starting a reviewed artifact as a
fresh host, never restoring old authority. This does not add durable recovery,
dual snapshots, remote transport, signed receipts or human approval.

## Executable evidence

[`liveActivation.test.ts`](../server/liveActivation.test.ts) covers:

- Permission endpoints → fake Codex process → real pinned HTTPS → Calcu `36`;
  both server-only receipts match the selected `0.1.2` tuple, and browser output
  contains no Grant/credential/identity/receipt authority fields.
- Startup preparation/tuple failures, owned TLS disposal, and fail-closed
  handling of unconfirmed agent cleanup.
- Retirement of several Grants/sessions and retained references, re-entrant
  verifier retirement, old credential/new executor and stale tuple rejection.
- Quota exhaustion across recreated mediators; no quota reset.
- Old cookie/offer rejection and fresh access review after clean restart.
- A valid delayed HTTPS round trip, followed by an observable pre-admission
  retirement barrier; no additional engine call. Observed cancellation at the
  server-side barrier likewise prevents execution.
- A post-execution response barrier: cancellation rejects successful presentation
  while the engine count correctly remains one. No automatic retry occurs.
- Valid-header partial HTTP/HTTPS bodies close without issuance/execution.
- Task-finalization waiting, idempotence and one shared deadline failure using
  an uncooperative test runner. Listener closure is not mistaken for readiness.

[`codexAdapter.test.ts`](../server/codexAdapter.test.ts) additionally tests
late-spawn cancellation, an actual TERM-ignoring fixture killed with confirmed
close/group termination, removal of only its task directory, and a simulated
process that never confirms close. Existing receipt-forgery, request-schema,
identity, task/UI and calculator tests remain part of the full gate.

These are deterministic fake-agent/real-transport observations, not authenticated
Codex provider inference or independent implementation interoperability.

## Measured authoring and host cost

Physical lines, including comments/blank lines, compared with merged P5-T8A
`d9cdc363e0bd5f9a8e2e2b444f14ead047251108`, measured at activation baseline
`b7d45160328c9ca35e0f71003c8d7c0a555fbf08` before the UI follow-up:

| Scope | Before | After | Change |
| --- | ---: | ---: | ---: |
| Manifest + shared declaration + historical wrapper | 442 | 397 | −45 |
| Demo entry/composition + owned server lifecycle | 108 | 229 | +121 |
| Executor, broker, mediator, HTTPS, task host, adapter | 2081 | 2247 | +166 |
| Combined production scope above | 2631 | 2873 | +242 |

The description has less duplication, but lifecycle safety adds code. This is
not a total-code saving claim and does not justify extracting a general runtime
SDK from one calculator. Legacy fixtures/tests are excluded from live authoring
cost. TypeBox `0.34.52` and the vendored SDK remain unchanged runtime dependencies.

The setup remains `npm ci` then `npm run agent:demo` (authenticated CLI 0.145.0,
POSIX, Node 22+, openssl); no manual schema copy/generation step is added.
Restart requires a new browser connection and access review.

## Validation

### Activation baseline

Local results at `b7d4516`, 2026-10-02 UTC, Node 26.5.0 (CI uses Node 22):

- `npm run check`: format, lint, typecheck, 266 Vitest tests in 28 files,
  6 preflight and 13 bundle-guard tests passed.
- `npm run build`: passed; production bundle isolation verified for 3 assets.
- `npm run test:coverage`: 266 tests passed; line coverage 88.40% (gate 80%).
- `git diff --check`: passed; 59 local document link targets resolved.
- Local CLI-host startup/GET/shutdown smoke: started on loopback, served the
  built UI with HTTP 200/CSP/session-cookie presence, stopped successfully on
  SIGTERM with exit code 0 and confirmed listener closure. Cookie contents were
  not printed. No task/model request was sent.

No dependency changes require another installation in this slice. Pushed-head
CI remains separate evidence. No authenticated Codex inference was performed;
an optional live task smoke is not a prerequisite for the deterministic gate.

### ASP details UI follow-up

Local results, 2026-10-02 UTC:

- 60 targeted panel, permission-parser, broker and task-host tests passed.
  They cover server-derived metadata, a closed public response, immutable
  submitted metadata, replacement, cancellation and failed-result hiding.
- `npm run build` passed, including browser/server bundle isolation.
- `npm run check`: formatting, lint and typecheck passed; 282 of 283 Vitest
  tests passed. The remaining HTTPS integration test could not create its
  temporary TLS directory because the disk was full (`ENOSPC`). Subsequent
  preflight and bundle-guard stages were not reached by this run.
- `npm run test:coverage`: all 283 tests in 29 files passed and computed line
  coverage was 88.43%, but writing the HTML coverage report failed with
  `ENOSPC`; the command exited unsuccessfully, so this is not a passed gate.
- `git diff --check` passed.
- Wide/compact visual audit is **unverified**: the existing Playwright browser
  was owned by another session, and the fallback in-app browser could not
  initialize its assets because the disk was full. No screenshots or DOM
  measurements were obtained. The audit-owned demo listener was stopped and
  confirmed closed; no model task was sent and unrelated caches were untouched.

CI must run the full gate on the new pushed head. Visual verification remains
a separate follow-up once local disk space is available.

Next: review this activation/lifecycle change and CI, then merge separately.
After merge/synchronization, optionally smoke the authenticated local demo;
use the measured cost to choose a bounded SDK follow-up, not to automate
authority issuance or expose additional application operations.

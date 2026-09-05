# Calcu ASP adoption report

## TL;DR

Calcu demonstrates one useful ASP path end to end: a user gives Codex CLI a
natural-language arithmetic task, Codex selects a single typed application
action, and Calcu independently admits and evaluates that action behind a local
HTTPS boundary. The verified application result is displayed separately from
untrusted model prose.

The experiment proves that the ASP authority boundary can separate an agent
from application business logic. It also shows that implementing the boundary
directly is too much infrastructure for a calculator: the reusable Grant,
identity, session, admission, transport, and adapter pieces should become SDK
packages before this is a practical onboarding path for ordinary applications.

This is a **Compatibility Bearer development profile**, not production ASP
certification or independent interoperability evidence.

## What runs

```text
Browser task panel
  → same-origin local task API
  → ephemeral codex app-server --stdio
  → calculation_propose dynamic tool
  → LocalBackend
  → loopback HTTPS POST /agent-actions
  → ASP admission and Calcu action executor
  → existing Calcu math engine
```

The browser and model never receive the ASP bearer, Grant, identity artifact,
private key, or raw action envelope. `LocalBackend` constructs the typed request;
the executor checks the current Grant, identity status, session generation,
surface hash, action, mode, schema, quota, and correlation before invoking the
math engine.

## Reproduce the live demo

Prerequisites:

- a POSIX environment (the process-group cleanup is currently POSIX-only);
- Node.js 22 or newer and `npm`;
- `openssl` available on `PATH` for ephemeral loopback TLS material;
- authenticated Codex CLI exactly `0.145.0`;
- account access to `gpt-5.6-luna`.

From a fresh checkout:

```sh
npm install
codex --version
npm run agent:demo
```

Open the printed `http://127.0.0.1:<port>/` URL and submit:

```text
Сколько будет 15% от 240?
```

The success view must show the executor-verified result
`240 × 0.15 = 36`. Model prose is optional and is never the source of success.
Stop the host with `Ctrl-C`; it cancels the active task, closes both loopback
servers, and removes temporary TLS material.

Task text is sent to the configured model provider. Codex authentication remains
CLI-managed and is not copied into Calcu. Set `CALCU_AGENT_DEBUG=1` only for local
protocol diagnostics; diagnostics intentionally exclude ASP authority.

## Evidence matrix

| Property | Executable evidence | What it establishes |
| --- | --- | --- |
| Typed proposal action | `server/boundary.test.ts`, `server/calcu.ts` | Only four closed binary operations can reach the existing math engine |
| Grant and session admission | `server/boundary.test.ts` | Foreign, expired, revoked, stale, substituted, or malformed authority fails before an engine call |
| Identity evidence | `server/boundary.test.ts`, `server/identity.ts` | Exact development envelope, artifact digest, Ed25519 key binding, freshness, and lifecycle status are checked |
| Protected local transport | `server/https.test.ts` | Exact HTTPS host/path/method/content type, pinned CA, size, timeout, abort, quota, no-store, and closed errors |
| Agent protocol isolation | `server/codexAdapter.test.ts` | Exact CLI/model/effort, one closed tool, correlated IDs, bounded JSONL, no/multiple tool rejection, timeout and cancellation |
| Full deterministic path | `server/codexAdapter.test.ts` | Fake app-server → LocalBackend → real loopback HTTPS executor → Calcu returns `36` |
| Browser task boundary | `server/taskHost.test.ts` | Same-origin cookie gate, one active task, bounded NDJSON, disconnect cancellation, and safe event projection |
| UI verification | `src/features/agent-task/*.test.ts*` | Verified result is required, fabricated/mismatched completion fails, retry works, late cancelled events are ignored |
| Client artifact isolation | `scripts/agent-demo/verify-client-bundle.*` | Generated browser files contain none of the known server-only protocol markers |

The Codex fixture is a deterministic **mock process**, not a real agent or
independent implementation. Default CI uses no Codex authentication and performs
no paid model inference. On 2026-09-05, a separate manual smoke using the real
authenticated CLI `0.145.0`, `gpt-5.6-luna`, and effort `low` made one
`calculation_propose` call and returned the verified result `36`.

## Rendered layout evidence

On 2026-09-05, P5-T4 inspected screenshots and DOM rectangles from the production
build served by `npm run agent:demo`. No model task was submitted during this
layout check.

| Effective viewport | Composition | Measured geometry | Result |
| --- | --- | --- | --- |
| 760 × 1000 | Compact, one column | Task panel `520 × 436.26` at `(120, 30.4)`; portrait calculator `520 × 702.78` at `(120, 497.05)`; vertical gap `30.39` | Full-page screenshot is legible; `scrollWidth = 760`; no horizontal overflow |
| 1440 × 900 | Wide, two columns | Task panel `472.31 × 486.54` at `(36, 206.73)`; landscape calculator `839.69 × 828` at `(564.31, 36)`; horizontal gap `56` | Both panels are visible; `scrollWidth = 1440`; no horizontal overflow |

The compact keypad exposed 19 visible controls and the landscape keypad exposed
49. The task submit button and a calculator digit were enabled in both layouts.
As an independent calculator smoke, clicking `7` changed the display from `0` to
`7`, and `AC` restored `0`, without starting Codex.

## Implementation and dependency cost

The experimental P5 surface currently contains more than 5,600 lines under
`server/`, `scripts/agent-preflight/`, and `src/features/agent-task/`, including
tests and fixtures. About 2,370 lines are server runtime code, roughly 620 lines
are task-panel client code/styles, and the remainder is test, fixture, and
diagnostic infrastructure. This excludes documentation and lockfile churn.

Three packages were added relative to the calculator baseline:

- `canonicalize` — RFC 8785/JCS object hashing;
- `yaml` — Agent Passport fixture parsing;
- `tsx` (development dependency) — local TypeScript server entrypoint.

That cost is acceptable for an experiment but not for a minimal application
integration guide. Most of it is protocol infrastructure duplicated inside
Calcu, not calculator-specific behavior. A practical ASP JavaScript/TypeScript
SDK should provide canonical hashing, closed envelope/schema validation, Grant
and session state, identity-verifier interfaces, HTTP bindings, safe error
projection, and tested runtime adapters. Calcu-specific code should eventually
shrink to its surface declaration, one action handler, and UI composition.

## Honest conformance status

| ASP role or property | Status |
| --- | --- |
| Surface Publisher | Fixed local `proposal_only` snapshot; no discovery endpoint |
| Grant Issuer | Implemented for the Compatibility Bearer development profile |
| Action Executor | Implemented for one non-persisted proposal action |
| Runtime Mediator | Implemented through LocalBackend and loopback HTTPS |
| Agent Adapter | Implemented for exact Codex CLI `0.145.0`; real-provider smoke is manual |
| Receipt Producer | Not implemented |
| Human Approval | Not implemented |
| Proof-Bound DPoP/mTLS | Not implemented |
| Production agent identity | Not implemented; the ephemeral identity represents the Calcu adapter, not the Codex binary |
| Independent interoperability | Not established |

The demo also does not provide durable consent, recovery, remote multi-user
deployment, general expression parsing, a reusable ASP SDK, or a WebMCP bridge.
Its bearer is short-lived, stored only in the trusted server process, bound to a
fresh Grant/session for one task, and revoked in a `finally` block, but it remains
a development credential profile.

## Adoption conclusion and next steps

The experiment is successful as a boundary test and intentionally unsuccessful
as a claim that ASP is already cheap to adopt. It validates the architecture
while exposing the next leverage point:

1. extract the reusable TypeScript core and server admission components from
   Calcu without changing protocol semantics;
2. make a second small application consume that package to reveal accidental
   Calcu coupling;
3. add Human Approval and signed receipt work as separate profiles rather than
   expanding this proposal-only demo;
4. reserve Proof-Bound transport and production identity for a production
   deployment profile with its own threat model and conformance evidence.

The detailed role mapping remains in [the conformance report](../server/CONFORMANCE.md),
and the original staged plan remains in [the demo plan](../SPECS/ASP_DEMO_PLAN.md).

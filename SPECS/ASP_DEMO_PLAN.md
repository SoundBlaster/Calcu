# Calcu + Codex CLI: minimal ASP demo

Status: P5-T3 Codex adapter, local task host and opt-in task UI implemented over
the P5-T2 Grant/identity/session and loopback HTTPS boundary. The profile is
Compatibility Bearer over loopback HTTPS; it is not production certification.
P5-T1 dynamic calculator round trip is verified with a synthetic provider. Internal
Codex tools are diagnostic observations, not an ASP admission blocker. The live
authenticated smoke remains an explicit manual check, not a CI conformance claim. See the
[preflight findings and reproduction](../scripts/agent-preflight/README.md).

User-selected demo agent: **GPT-5.6 Luna** (`gpt-5.6-luna`) through Codex CLI,
with reasoning effort **low**. Set these explicitly for the demo process without
changing global Codex configuration. The implementation must verify availability
in the installed CLI/account; P5-T3's live smoke supplied that evidence. Do not silently
substitute another model or reasoning level.

## Outcome

Add an opt-in task panel alongside the existing calculator:

1. The user enters `Сколько будет 15% от 240?` and submits it.
2. Codex CLI interprets the request and calls the application's tool.
3. Calcu calculates `240 * 0.15` using its existing math implementation.
4. The panel displays `36` and the actual operation, arguments, and result.

A model-generated answer without a verified application result is not a successful
demo. No deterministic phrase matcher will impersonate the agent. Ordinary
calculator use remains available without Codex or a running backend.

## Inspected baseline

Calcu: `4c7181a686d9bdf3e268776be74d5ae60e49f033`.
ASP: `951871c2d55db25d35512f29cc0970c69aa5cfd9`.

- [App](../src/app/App.tsx) currently renders only the calculator. Add a sibling
  task feature rather than repurposing its output display.
- [Math implementation](../src/features/calculator/lib/scientificMath.ts)
  exports `evaluateScientificBinaryOperation`. Use a narrow facade over this
  function, not a second implementation of arithmetic.
- The reducer implements immediate-execution keypad semantics, not an expression
  parser. Do not simulate `240 × 15 % =`: its current percent semantics differ
  from percent-of calculation. Preserve existing keypad behavior.
- There is no application server, agent runner, or ASP adapter.

## Proposed boundaries

```text
Task panel → local task service → Codex CLI
                                    ↓ MCP tool call
                              ASP runtime mediator
                                    ↓ authenticated ASP request
                              Calcu action executor
                                    ↓
                              existing math function
```

Use a small local Node/TypeScript service and the Codex app-server dynamic tool
protocol. Task text is protocol data, never shell syntax. The tool is an adapter,
not an authorization bypass. The application independently
verifies the current Grant and session before calling the engine. Components may
share a service package, but runtime-held credentials and application verification
remain separate responsibilities.

Local Codex authentication stays CLI-managed: do not copy credentials into Calcu.
No runtime proof material reaches the browser or model. Explain before submission
that task text goes to the configured model provider: local CLI does not imply
local inference. No new generic SDK or browser-to-process execution.

## Surface and honest conformance

Target the existing [Mediated Proposal bundle](https://github.com/0al-spec/agent-surface/blob/951871c2d55db25d35512f29cc0970c69aa5cfd9/conformance/v1/bundles.json).
There is no executable read-only foundation bundle; Surface Catalog alone does
not establish invocation conformance.

Expose one tentative action, `calculation.propose`, returning a typed,
non-persisted calculation suggestion with operands, operator, and result. It does
not change display state, memory, history or files. Use `surface_mode: proposal_only`,
`execution.mode: propose`, `side_effect: false`, no effects and no persistence.
The result is an artifact, not authority for another operation. This follows the
[Proposal-Only contract](https://github.com/0al-spec/agent-surface/blob/951871c2d55db25d35512f29cc0970c69aa5cfd9/drafts/modules/core.md#proposal-only-surface-mode).

Initial domain payload, not the complete ASP wire envelope:

```json
{"operator":"multiply","left":240,"right":0.15}
```

Initially allow only add, subtract, multiply and divide. Reject unknown fields,
unsupported operators, non-finite inputs/results and division by zero. No `eval`,
executable expressions or unbounded action sequences. Test precision and formatting.

Before claiming conformance, map and exercise the complete bundle closure:
Surface Publisher, Grant Issuer, Action Executor, Runtime Mediator and Agent Adapter.
Use registry requirements/vectors without hand-shortening them, plus applicable
normative and transport obligations. P5-T1 must select the exact app-issued Grant,
identity evidence, credential proof, session/generation binding and authenticated
HTTP deployment profile. Grant IDs/hashes alone are not credentials. A local
compatibility profile must not be presented as a stronger production profile.

Do not claim Receipt Producer, full ASP conformance, or independent interop. A
tool trace is not a signed receipt. Implement evidence required by the selected
closure or report the missing claim. MCP connectivity alone also does not prove
ASP-over-MCP binding conformance.

## Delivery slices

### P5-T1 — Contract and CLI preflight (implemented; live evidence supplied by P5-T3)

- Confirm installed CLI version and isolated non-interactive MCP invocation.
  Local `codex exec --help` exposes stdin, JSONL, ephemeral runs, sandbox selection
  and user-config isolation; verify behavior before relying on these options.
  Do not alter global user configuration.
- Keep app credentials outside agent contexts and expose no application bypass.
  Agent-internal tools and subagents are not an ASP rejection criterion. Diagnostic
  tool inventory is a deployment observation, not the application's authority gate.
- Define typed I/O and the full ASP requirement/identity/transport mapping.
- Exit: bounded tool smoke test, exact tested versions and documented boundaries.

### P5-T2 — Calculator facade and ASP execution (implemented development slice)

Implemented: [server boundary](../server/README.md), exact closed Grant/identity/
session state, RFC 8785/JCS hashes, ephemeral test Passport verification,
server-only loopback HTTPS, bounded admission, response correlation and direct
negative tests. This remains a Compatibility Bearer development profile, not
complete production ASP support.

- Reuse the existing math function through strict, pure validation.
- Add independent app-side Grant/session/manifest checks and runtime mediation.
- Bound request/response size, quota, timeout and action scope. Protect the
  loopback endpoint with HTTPS, pinned test CA, exact Host/path/method/content
  checks and no redirect following; loopback is not authentication. Never
  expose an arbitrary process launcher.
- Exit: valid calculation succeeds; malformed input, expired/revoked authority and
  mismatched identity/session/surface are rejected before engine execution.

### P5-T3 — Task UI and Codex round trip (implemented; live smoke is manual)

- Add input, submit, pending/success/error/cancelled states and actual call trace.
- Correlate application results with the current task; ignore late results after
  cancellation/replacement. Cancellation must terminate the child process.
- Display application numeric output separately from untrusted model prose.
  Missing/conflicting tool evidence must not produce a success state.
- Preserve keyboard behavior, responsive layouts and ordinary offline use.
- Exit: the percent example returns verified 36; missing CLI/authentication,
  timeout and unsupported input have useful errors.

Implemented as one ephemeral `codex app-server --stdio` process group per task,
pinned to Codex CLI `0.145.0`, `gpt-5.6-luna`, effort `low`, no fallback,
`approvalPolicy: never`, read-only sandbox, empty environments/capability roots,
and one closed dynamic tool. A same-origin loopback host streams bounded NDJSON
events while keeping the Grant, identity evidence, bearer and raw ASP envelope
out of the browser and model. Each task receives a fresh Grant/session that is
revoked in a `finally` block. Fake app-server, HTTPS integration, host API and UI
tests are deterministic CI evidence; `npm run agent:demo` is the authenticated
manual smoke command.

Manual smoke on 2026-09-05 with authenticated Codex CLI `0.145.0` completed the
Luna `low` dynamic-tool path and returned the executor-verified result
`240 × 0.15 = 36`. This is local evidence, not an automated interop claim.

### P5-T4 — Verification and adoption report (pending)

- Run `npm run check`, `npm run build`, new deterministic adapter/UI tests,
  negative authority cases and applicable conformance checks.
- Fake CLI fixtures cover malformed/truncated events, nonzero exit, no tool call,
  fabricated result, timeout and cancellation. Label these as mocks, not real agents.
- Real authenticated CLI smoke tests are explicit/manual, outside default CI;
  CI needs no model credentials or paid inference.
- Verify rendered narrow/wide layouts. Document reproduction, setup steps,
  added code/dependencies, actual evidence and remaining limitations.
- Exit: one documented demo command after prerequisites; incomplete conformance
  reported honestly rather than silently expanding scope.

## Non-goals and stop conditions

No SpecSpace dependency, persistence/recovery workflow, human approval ceremony,
arbitrary scientific-expression parser, remote multi-user service, WebMCP bridge
or production certification. This explicitly extends the original calculator scope
without changing keypad semantics or adding history/accounts.

If the smallest bundle requires substantial unrelated infrastructure, record an
ASP adoption finding and ask for a scope decision. Do not invent a private
read-no-grant profile or build a framework to conceal the cost.

Next implementation task: complete **P5-T4** with rendered layout evidence, a
documented live-smoke result and an adoption report. Human approval, receipts and
Proof-Bound transport remain separate follow-ups. No normative ASP changes are
planned.

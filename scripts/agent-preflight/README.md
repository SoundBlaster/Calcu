# P5-T1: offline CLI / calculator preflight

This is a disposable diagnostic, **not an ASP executor**. It does not issue Grants,
authenticate application actions, call a real model, or establish conformance.

```sh
npm ci
npm run test:agent-preflight
npm run agent:preflight
node scripts/agent-preflight/probe.mjs --app-server
npm run agent:preflight:dynamic
```

The first command installs the repository dependencies. Tests require Node 22+
and no Codex installation, credentials or inference. The diagnostic additionally
requires Codex CLI on PATH and a POSIX host (macOS/Linux; Windows fails closed).
It uses a temporary empty HOME/CODEX_HOME and working
directory, a loopback mock Responses provider, and a disposable MCP fixture. It
transpiles the existing Calcu math module with the installed TypeScript compiler;
it does not copy or reinvent arithmetic. Temporary files are removed after the run.
Do not point this mock provider at an authenticated production session.

The capture-only modes deliberately return HTTP 400 after the initial request.
The dynamic mode instead returns one fixed synthetic Code Mode call, then captures
the returned tool evidence in the next provider request and ends with HTTP 400.
This model-turn failure is expected; exit status comes from the diagnostic's own
gate. Exit 1 means the gate did not pass (or the probe could not run), not a
successful isolated agent. It sends no inference
request to OpenAI; it is not a general OS network sandbox for the CLI itself.

## Observed on 2026-09-05

Environment: macOS, Node `26.5.0`, Codex CLI `0.145.0`.

- Captured model `gpt-5.6-luna`, reasoning effort `low`.
- MCP server started and received `initialize` and `tools/list`.
- Initial model-facing tools were `exec`, `wait`, `request_user_input`.
- The `exec` description still exposed `apply_patch`, `view_image`, MCP resource
  helpers and `update_plan`, despite disabled shell and other optional features.
- Calculator was not advertised in this captured initial tool list. This does
  not prove it can never appear later; the mock response ends the turn immediately.
- The initial allow-list gate failed. **No real Luna calculation was run.**

The alternative `--app-server` probe uses the same isolated mock provider and
sets `environments: []` on both thread and turn. Its captured initial request no
longer includes `apply_patch` or `view_image`, but still contains the generic
`exec`/`wait`/`request_user_input` tools, MCP resource helpers, `update_plan`, and
`skills__list`/`skills__read`. The calculator remains absent from that initial
request despite MCP initialization/listing. This alternative also exits 1;
environment disabling alone does not satisfy this probe's strict allow-list.

### Dynamic tools and corrected gate

`agent:preflight:dynamic` uses app-server `dynamicTools` with `environments: []`,
no MCP server, and the same temporary empty home. In this configuration:

- `calculation_propose` **is advertised inside Code Mode `exec`**. The previous
  top-level-only detector falsely reported it absent. `exec` is not itself a shell.
- A fixed synthetic provider response invokes that dynamic tool. The application
  handler calculates `36`; its result returns through Code Mode to the next
  provider request. This is not a Luna-generated decision or live inference.
- Attempts to invoke absent `exec_command`, `view_image` and `apply_patch` fail
  with TypeError. Host globals `process`, `require` and `fetch` are undefined.
- Runtime enumeration also finds five **unadvertised** `multi_agent_v1__*` keys
  (`spawn_agent`, `close_agent`, `resume_agent`, `send_input`, `wait_agent`) despite
  disabled multi-agent. They are not invoked and are not added to the allow-list.
  Their presence is a review blocker, not proof that their handlers can execute.
- Therefore the current real CLI probe still exits 1: `mediatedResultVerified`
  and `forbiddenUnavailable` are true, but `runtimeInventoryMatches` is false.

The gate now separates advertisement from execution evidence:

1. `calculatorToolPresent` recognizes direct tools and nested Code Mode headings.
2. `wrapperCandidate` checks the expected wrapper shape and rejects unknown
   advertised tools. Descriptions alone can never pass the dynamic gate.
3. The fixed synthetic program enumerates actual runtime bindings, exercises the
   calculator, and tries calling missing host tools (exposed tools are flagged,
   not invoked). The parent separately records its calculator handler invocation.
4. `capabilityProbePassed` requires the exact reviewed runtime inventory, denied
   host operations, a matching nonce/call ID, the parent invocation and matching
   result in the next request. Missing/duplicate evidence or changed models fail.

`initialRequestGatePassed` remains the legacy **direct-tool-only** shape check;
the dynamic command's exit status uses `capabilityProbePassed`, not that field.
Planning and skills helpers are explicit expected diagnostic bindings, not an
assertion that their implementations are security-audited. Even a passing dynamic
probe reports `toolIsolationProven: false`; this is a bounded capability test,
not proof against every possible escape or later provider behavior.

The deterministic MCP fixture test separately invokes the tool and gets `36` from
Calcu for `{operator: "multiply", left: 240, right: 0.15}`. That is a protocol-fixture
test, not evidence that Luna chose or executed the tool.

Capture covers only the initial request under the mock provider. Even a passing
gate would not prove production-provider equivalence, later tool updates, handler
enforcement, OS isolation, identity verification or ASP conformance. Nested tool
headings are informational text; they are never treated as an authoritative
allow-list. Unknown tools fail closed. The recognized Code Mode wrapper requires
runtime evidence rather than unconditional rejection or unconditional acceptance.

## P5-T1 status and next decision

**Partial / blocked on tool isolation.** Do not proceed to a browser-accessible
task service using this CLI configuration. Additional file tools being exposed
does not demonstrate an exploitable write, but it fails our intended tool-only
boundary. Do not weaken the claim to make this test pass.

Next: establish whether the unadvertised multi-agent bindings can be disabled or
are rejected by their handlers; review the remaining skills/plan helpers before
claiming the intended boundary. Retain Luna low and CLI-managed authentication.
Do not bypass the gate by adding unknown bindings to the allow-list. If this
cannot meet the boundary, choose an
externally isolated CLI environment with explicit filesystem/network restrictions.
Either path needs a fresh inventory and a real tool round-trip test before P5-T2.
No complete isolation path or real-model execution is established by this probe.

## Planned ASP contract (still unimplemented)

Use the pinned [ASP registry](https://github.com/0al-spec/agent-surface/blob/951871c2d55db25d35512f29cc0970c69aa5cfd9/conformance/v1/bundles.json),
not a new private read-only profile.

| Boundary | Planned choice / mandatory evidence |
| --- | --- |
| Surface | `proposal_only`; non-persisted `calculation.propose`; no effects or companion writes |
| Input/output | Four arithmetic operators, finite numeric operands/result, closed input shape |
| Grant | App-issued; exact single-action allow-list; expiry, revocation, audience and current tuple checks; credential release denied |
| Credential | Explicit development Compatibility Bearer profile over confidential authenticated HTTP; not Proof-Bound |
| Identity | Concrete verifiable evidence and key binding required; issuer/trust setup remains unresolved until runtime isolation is chosen |
| Session | Application-authoritative session/generation, exact Grant/runtime/agent/application/surface binding |
| Runtime | Custody of credentials outside all model/browser context; request construction and policy checks |
| Executor | Independent validation before invoking the pure math facade |
| Claims | Full Mediated Proposal requirement/vector closure plus applicable normative obligations; no current claim |

The local MCP stdio fixture is only a CLI connectivity probe. The intended adapter
will mediate a separate authenticated ASP HTTP invocation; it is not yet an
ASP-over-MCP binding implementation. No receipts or identity evidence are fabricated.
The dynamic probe uses app-server function calls instead of MCP; this adapter
experiment does not change the ASP contract or imply ASP-over-MCP conformance.

Sources: [ASP Proposal-Only](https://github.com/0al-spec/agent-surface/blob/951871c2d55db25d35512f29cc0970c69aa5cfd9/drafts/modules/core.md#proposal-only-surface-mode),
[ASP authorization](https://github.com/0al-spec/agent-surface/blob/951871c2d55db25d35512f29cc0970c69aa5cfd9/drafts/modules/authorization.md),
[OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference),
[OpenAI non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).
Local CLI observations, rather than documentation alone, determine the failure above.

## CI scope

`npm run test:run` includes the credential-free fixture/gate tests. CI does not run
the installed-CLI diagnostic or a real model. The server is deliberately a tiny
probe subset, not a reusable complete MCP server: no concurrent service, persistence
or application authority. All executable files live under this diagnostic directory.

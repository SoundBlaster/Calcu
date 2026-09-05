# P5-T1: offline CLI / calculator preflight

This is a disposable diagnostic, **not an ASP executor**. It does not issue Grants,
authenticate application actions, call a real model, or establish conformance.

```sh
npm ci
npm run test:agent-preflight
npm run agent:preflight
node scripts/agent-preflight/probe.mjs --app-server
```

The first command installs the repository dependencies. Tests require Node 22+
and no Codex installation, credentials or inference. The diagnostic additionally
requires Codex CLI on PATH and a POSIX host (macOS/Linux; Windows fails closed).
It uses a temporary empty HOME/CODEX_HOME and working
directory, a loopback mock Responses provider, and a disposable MCP fixture. It
transpiles the existing Calcu math module with the installed TypeScript compiler;
it does not copy or reinvent arithmetic. Temporary files are removed after the run.
Do not point this mock provider at an authenticated production session.

The mock provider deliberately returns HTTP 400 after capturing the initial
request. That model-turn failure is expected; the diagnostic's exit status comes
from its own initial tool-list gate. Exit 1 means the gate did not pass (or the
probe could not run), not a successful isolated agent. It sends no inference
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

The deterministic MCP fixture test separately invokes the tool and gets `36` from
Calcu for `{operator: "multiply", left: 240, right: 0.15}`. That is a protocol-fixture
test, not evidence that Luna chose or executed the tool.

Capture covers only the initial request under the mock provider. Even a passing
gate would not prove production-provider equivalence, later tool updates, handler
enforcement, OS isolation, identity verification or ASP conformance. Nested tool
headings are informational text; they are never treated as an authoritative
allow-list. Unknown top-level tools fail closed, including generic code execution.

## P5-T1 status and next decision

**Partial / blocked on tool isolation.** Do not proceed to a browser-accessible
task service using this CLI configuration. Additional file tools being exposed
does not demonstrate an exploitable write, but it fails our intended tool-only
boundary. Do not weaken the claim to make this test pass.

Recommended next bounded investigation: test app-server `dynamicTools` with
`environments: []`, characterize the remaining orchestration/skill tools and
enforce the intended boundary, while retaining Luna low and CLI-managed
authentication. The locally generated experimental schema exposes `dynamicTools`;
its availability is not proof of isolation or an equivalent MCP adapter.
If this cannot meet the boundary, choose an
externally isolated CLI environment with explicit filesystem/network restrictions.
Either path needs a fresh inventory and a real tool round-trip test before P5-T2.
Neither complete path is implemented or established by this probe.

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

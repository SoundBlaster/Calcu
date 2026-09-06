# Calcu retention feasibility: ADP-03

Status: candidate contract with partial local evidence, not an advertised ASP
retention capability. No live Codex or provider test was performed.

## Concrete candidate

For application-originated calculator output delivered to the runtime/agent:

```json
{"mode":"transient","delete_on_grant_end":true}
```

This is a proposed `data_exposure.retention` member, not a complete manifest or
Grant. The current development surface does not contain that contract. It means
no durable runtime/agent payload persistence, and release of runtime-controlled
plaintext copies when the Grant ends. It does not promise forensic erasure,
deterministic garbage collection, provider deletion or model unlearning.

The application owns its returned UI projection; revoking agent authority does
not erase the user's displayed calculator result. This ownership must remain
explicit in the eventual contract, not be used to relabel an agent cache as UI.
Task-input retention is a separate application policy, not implied by the
action-output exposure rule. This experiment introduces no synthetic-only gate.

## Copy ownership and evidence

| Copy | Owner and lifetime | Evidence / limit |
| --- | --- | --- |
| User textarea, submitted snapshot, result, trace, unverified prose | Application UI React state until replacement/unmount; cancellation hides completion but does not prove state erasure | Existing panel/protocol tests; no new history/export or durable browser store |
| Task-host local variables and serialized responses | Application host request scope | Not a runtime/agent cache; `no-store` is a transport control, not proof of deletion |
| Adapter protocol buffer, pending parse queue, task, tool result and prose | Adapter execution scope | Listeners/timer removed and child stopped at settlement; no deterministic JS-memory wipe claim |
| Temporary work directory and `TMPDIR` | Adapter-created, removed in `finally` after process stop | `retentionBoundary.test.ts` verifies removal of a deliberately written synthetic file on success, malformed response, timeout and cancellation |
| Optional diagnostics | Adapter/demo stderr sink | Only fixed stages/status and classified error codes; raw IDs, methods, error text and status are not forwarded. Adversarial marker tests cover those channels |
| Codex thread/model context | External CLI, selected as agent | Fixture validates `ephemeral: true`; actual pinned CLI's rollout/cache/diagnostic behavior is not proven by the fake process |
| Remote model/provider copies | Downstream provider | No additional whole-path/training profile selected; no provider deletion or training assertion |
| Grant and identity records | Authoritative executor Map | Revoke disables authority but retains records. Separate lifecycle/minimization debt; not calculator output and not fixed here |

## Executable checks

```sh
npx vitest run server/retentionBoundary.test.ts server/codexAdapter.test.ts
```

The seven added checks exercise a real child **fake** app-server without
credentials or network requests. Three diagnostic cases failed before the fix
because CLI-controlled text was forwarded to the diagnostic sink. They now
pass. Four lifecycle cases verify temporary-directory cleanup; they do not
prove that a real CLI never writes elsewhere, or that it cannot read data before
cleanup. Returned application-owned output remains available after cleanup.

## Decision

`transient` is a concrete design candidate, not yet a verified capability for
the complete Calcu/Codex path. The remaining feasibility check is specifically
the selected CLI agent's local rollout/cache/diagnostic behavior and the
adapter's outstanding-reference lifecycle, not a request for enterprise/ZDR or
a synthetic-only workload. Current public app-server documentation describes
in-memory ephemeral forks, but does not establish all retention behavior of
the demo's pinned CLI `0.145.0`:
[official app-server documentation](https://developers.openai.com/codex/app-server/).

Do not advertise this capability or use a Grant requiring it until the base
runtime-agent contract is enforceable. A future isolated real-CLI test must use
synthetic markers and an explicitly approved credential strategy; never copy
the user's auth store merely to run the experiment. Grant/identity record
minimization and UI unmount cancellation remain separate follow-up debt.

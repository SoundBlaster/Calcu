# Calcu application boundary and Codex task adapter — P5-T3

This directory contains the Calcu application-boundary and task-adapter slices for the ASP
Mediated Proposal flow. It is a development profile named **Compatibility Bearer
over loopback HTTPS**. It is not a production authorization service and does
not claim Proof-Bound, DPoP, mTLS, receipt, or human-approval conformance.

```text
LocalBackend
    │ typed action.request + Authorization header
    ▼
HTTPS POST https://127.0.0.1:<port>/agent-actions
    │ exact host/path/content-type/size checks
    ▼
ASP Action Executor
    │ grant, identity, session, quota and input admission
    ▼
evaluateScientificBinaryOperation
```

The opt-in demo adds a separate server-only path without changing that trust
boundary:

```text
AgentTaskPanel
    │ same-origin POST /api/tasks/run + bounded NDJSON
    ▼
local task host
    │ one ephemeral process group per task
    ▼
codex app-server --stdio (CLI 0.145.0, Luna low)
    │ dynamic tool: calculation_propose
    ▼
LocalBackend → pinned loopback HTTPS → Action Executor → Calcu engine
```

The adapter accepts exactly one successful calculator tool call. It validates
the app-server thread, turn, call, tool name and closed arguments before calling
`LocalBackend`. Model prose is retained only as bounded untrusted presentation;
success and the safe trace are derived from the application result. Cancellation,
disconnect, timeout or protocol failure sends the process group `SIGTERM` and
then `SIGKILL` after one second.

## Closed application contract

`createCalcuExecutor({ now, identityVerifier })` owns the authoritative
control-plane state. The only exported surface is a proposal-only action:

- `surface_mode`: `proposal_only`;
- action and scope: `calculation.propose`;
- execution mode: `propose`;
- `side_effect`: `false`;
- `credential_release.mode`: `deny`.

The trusted `issue(request)` operation accepts a closed `GrantRequest` only:
the application supplies a user, runtime, agent, identity evidence, fixed
audience and short expiry. It never synthesizes default identities and callers
cannot choose an action, mode, scope or credential. The resulting authoritative
Grant contains a JCS `grant_hash`, fixed surface hash, subject/delegate tuple,
identity-evidence projection and compatibility bearer binding. The raw bearer
is returned only to the trusted local mediator; the executor retains only its
domain-separated hash.

Each Grant has one authoritative `SessionRecord` with a generation and state.
Grant revocation, expiry, or session rotation makes subsequent requests fail
closed before the calculator engine. Session rotation invalidates the old
generation and revokes the current development session; a future renewal API is
deliberately outside this slice.

## Identity evidence

`IdentityEvidenceVerifier` is the application-owned verification interface. The
development/test implementation validates the ASP `agent-identity-evidence/v1` envelope,
the minimal Agent Passport profile, exact artifact digest, Ed25519 signature,
issuer/subject projection, key binding, freshness and lifecycle status.

Tests generate an ephemeral Ed25519 key and Passport in a unique temporary
directory/memory fixture. No private key or production trust root is committed.
The fixture can fail closed with `active`, `revoked`, `expired`, `unknown` or
`unavailable`; unknown verification profiles return
`identity_evidence_profile_unsupported`. The verifier is development/test
infrastructure, not a production identity provider. The demo identity identifies
the Calcu adapter, not the Codex executable. Its key material is ephemeral and
never sent to the browser or model.

## Local task host

`npm run agent:demo` builds the UI, starts both loopback servers on random ports,
and prints the browser URL. The static host sets an HttpOnly `SameSite=Strict`
process-session cookie. `POST /api/tasks/run` requires the exact loopback Host,
same Origin, cookie and a closed task body, permits one active task, disables
CORS/caching and returns only a bounded NDJSON projection. The browser never
receives a Grant, bearer credential, Passport, identity digest or raw ASP request.

The command requires the already authenticated `codex` CLI version `0.145.0`.
Authentication remains CLI-managed; Calcu only passes allow-listed path, proxy
and TLS environment variables and never reads or copies CLI credentials.

Object hashes use the ASP Canonical Object Hash Profile: RFC 8785 JCS over the
exact `{ "domain": <URI>, "object": <hashing view> }` wrapper, SHA-256 and
unpadded base64url. The artifact digest uses the ASP Agent Passport artifact
profile's exact octet and domain-prefix rule.

## Protected transport

`createActionHttpsServer` is server-only and listens on `127.0.0.1`. It accepts
only `POST /agent-actions` with the exact bound Host, JSON content type, a
Bearer credential in `Authorization`, and an 8 KiB request limit. Responses are
closed JSON ASP error envelopes or an 8 KiB action result; all responses use
`Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

`createAuthenticatedHttpsTransport` accepts only an `https:` loopback URL with
the exact path, pins the supplied CA/certificate, sets
`rejectUnauthorized: true`, never follows redirects, enforces request/response
limits, and supports timeout plus `AbortSignal`. The credential is never put in
the action JSON body. There is no CORS trust, arbitrary process launcher, or
browser import of server modules.

The HTTPS tests generate a one-day test certificate with `openssl` in a unique
temporary directory and use its certificate as the pinned CA. The key is read
only during the test and removed afterwards.

## Mediated Proposal mapping

The current executable coverage and its deliberate limits are recorded in
[`CONFORMANCE.md`](./CONFORMANCE.md). In short:

- Surface Publisher: fixed local snapshot, not a published manifest endpoint;
- Grant Issuer: exact development Grant/identity/session contract;
- Action Executor: independent per-request admission and quota;
- Runtime Mediator: LocalBackend plus authenticated loopback transport;
- Agent Adapter: ephemeral Codex app-server with one dynamic tool, backed only by
  LocalBackend;
- Receipt Producer and human approval: not implemented in P5-T3.

Run the local quality gate with:

```sh
npm run check
npm run build
npm run test:coverage
git diff --check
```

The tests include fake app-server lifecycle/protocol cases, a fake Codex → real
HTTPS executor integration, task-host security/error cases, UI stream/cancel/
retry cases, and positive HTTPS round trips plus negative cases for
credential, identity, grant/session binding, action/mode/input, host/path/
method/content-type, TLS, redirect, size, timeout, abort, quota and correlated
response failures. Rejection paths assert that the current request does not
reach the engine.

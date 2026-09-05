# Calcu application boundary — P5-T2 first slice

`createCalcuExecutor()` owns admission state and invokes the existing Calcu engine.
Its `issue`, `revoke`, and `rotateSession` methods are trusted application control
plane operations, **not agent tools**. `issue()` is development provisioning, not
a user-consent flow or complete ASP Grant issuer.

`createLocalBackend(access, transport)` returns only `calculationPropose(args)`.
The function accepts arithmetic operands, never caller-selected Grant/session,
action, credential, or execution mode. It constructs an `action.request`, keeps
the opaque credential out of that body, and validates correlated `action.result`
before returning numeric output. Model prose does not enter this path.

The executor independently validates the credential, expiry, revocation, current
session generation, Grant/surface bindings (`subject.user`, `delegate.runtime`,
`delegate.agent`, and resource-server `audience`), action/mode, closed input
schema, request size and a three-invocation budget. Recreating a LocalBackend does
not reset that app-owned budget. Failed arithmetic consumes an admitted invocation.
Execution is synchronous and non-persisted; no UI/memory/history state changes.
The mediator receives a deep copy of the binding, so changing its subject or
delegate projection cannot mutate the executor's authoritative Grant state.

## Scope and trust

This first slice uses a **trusted in-process serialized transport**, not HTTP.
Credential custody is an API/code-ownership boundary, not process isolation.
Do not expose provisioning methods, use this transport across an untrusted network,
import server modules into the browser, or give Codex access to server credentials.
Agent internals/subagents are not an admission criterion. Their requests receive
exactly the same application checks.

The message shape follows ASP Action Request/Response, but this is **not yet a
conforming ASP implementation**. The local surface snapshot and grant-state hash
are not normative manifest/Grant documents or claimed ASP JCS digests. Concrete
identity-evidence verification, user consent and durable subject/delegate
provisioning, normative hashing, session establishment, authenticated confidential
HTTP, protocol error envelopes and the complete Mediated Proposal conformance
closure remain pending. The generated identifiers only make the tuple explicit;
they are not identity evidence.
There is no receipt or Proof-Bound claim. The opaque credential is development
bearer-like authority held only by the trusted mediator.

## Verification and next slice

`npm run check` includes `server/boundary.test.ts`: real arithmetic and negative
admission tests directly bypass LocalBackend to check executor enforcement.
These tests use an injected clock, not a model, network service or credentials.

Next: replace development provisioning with the exact ASP Grant/identity/session
contract and add authenticated transport. Then wire the Codex dynamic tool to the
LocalBackend facade and build the task panel. This slice opens no endpoint.

References in the local ASP checkout: `drafts/modules/core.md` (Action Request /
Action Response) and `drafts/modules/authorization.md` (Grant Credentials /
Subdelegation). In particular, downstream helpers do not inherit Grant authority.

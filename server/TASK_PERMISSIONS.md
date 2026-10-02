# Task-scoped access selection

## Scenario

The user enters “What is 15% of 240?” and chooses **Review access**. Calcu
returns a server-issued access offer for that exact trimmed task. No agent runs,
no Grant is issued and no calculator engine is called at this stage.

The panel asks for two initially unchecked permissions:

1. Allow `calculation.propose`: add/subtract/multiply/divide, with one successful
   calculator tool call per task enforced by the adapter.
2. Allow the action's required data disclosure: calculation content and runtime
   context (`sensitive`), and fixed statuses (`private`), using `user_managed`
   retention. The chosen agent remains responsible to the user for its handling.

Both are required for this existing action; partial disclosure is not a supported
alternative contract. Declining either means no execution. The ordinary
calculator remains available. The task text is itself deliberate user disclosure
to the chosen model provider only after running; reviewing it sends it only to
the local application host.

## Server boundary

```text
POST /api/tasks/permissions { task }
  -> one outstanding offer, exact task + current surface, expires in 60 seconds
POST /api/tasks/run { task, permission: { offer_id, actions, data_classes } }
  -> exact selection check and single-use consumption
  -> server-only issuance permit
  -> surface/task/freshness check at issuePermittedTaskGrant
  -> executor.issue -> Codex -> LocalBackend -> HTTPS executor
```

Both endpoints require exact Host, Origin, JSON Content-Type and the process
session cookie; neither enables CORS. Request limits and `no-store` apply. Only
one task runs at a time. A new offer replaces the old one; there is no unbounded
pending-offer collection. Offers contain only an opaque random ID, expiration,
the action and required class labels/classifications/retention. Grant, bearer,
identity artifacts and internal authority bindings are not sent to the browser.

The server compares exact action and class sets: missing, duplicate, extra or
substituted entries fail before the execution callback. Task text must match
the reviewed trimmed bytes. This byte binding does not prove meaning. A permit
is registered in a server-side WeakMap, cannot be fabricated from JSON, expires,
and can be claimed for issuance only once. Its surface hash must equal the
executor's configured snapshot supplied by the trusted demo composition.

The issuer still independently verifies identity and derives exact Grant exposure
from the manifest. Selecting an action in browser JSON does not change the
surface, issuer policy or allowed actions. Failed issuance consumes the permit;
retry requires a fresh review. Completion/error/cancellation retain the demo's
existing Grant revocation. Revocation does not delete earlier disclosed data.

## UI lifecycle

Editing the task invalidates the offer and unchecks both permissions. Running
consumes the local offer before the request; retry must review again. Preview
loading uses AbortController and client generation checks: cancelled or stale
offers cannot re-enable execution. Expiration is rechecked on submit and at the
server; the UI displays the remaining time and requires a fresh access request after expiry. No persistent approval
preferences or “always allow” mode are introduced.

## Evidence and non-claims

The current broker and executor still select version `0.1.1`. P5-T8A's
[SDK-authored `0.1.2` candidate](../docs/LIVE_SDK_MANIFEST_PREPARATION.md) is
prepared only; these offers cannot select its version or schema namespace.
Rebinding access review and authority to it requires the separate P5-T8B
activation/retirement transition.

`taskPermissions.test.ts` checks exact selection, expiry, replacement, replay,
forged permits, changed task/surface and one-time issuance. It also runs a valid
selection through the real issuer, LocalBackend and executor (in-process test
transport), returns `36`, then verifies revocation prevents another engine call.
Existing HTTPS tests independently cover transport. `taskHost.test.ts` exercises
both browser endpoints and ensures denied selections never reach execution.
Panel tests cover unchecked choices, editing, malformed offers, retry and
cancelled generations. None of these are new live Codex evidence.

This is local development authorization selection under the existing process
session, not authenticated end-user identity, durable consent, a signed Approval
Receipt or proof that a human clicked. A caller holding that process session can
submit a matching acknowledgement. The UI is not a security boundary by itself.
The principal remains the demo's synthetic local user; identity represents the
adapter, not the Codex binary. It does not approve exact operands/effects or
verify natural-language interpretation, and it does not establish full ADP-03
or production conformance. ASP normative text and the SDK package remain unchanged.

# P5-T9A-F — Dispatch deadline and mediator input repair

Date: 2026-10-02 UTC. This focused correction follows
[P5-T9A characterization](HANDLER_BINDING_CHARACTERIZATION.md), recorded in
[Calcu #20](https://github.com/SoundBlaster/Calcu/pull/20) at
`6199f3df64a1c0bfdcc175d3ad7945a40e1a225a`. It changes the two existing server
components, not the SDK or application surface.

## User scenarios

- Access was valid when the request arrived, but expired while identity was
  checked: reject before invoking the calculator, not after returning a result.
- A trusted clock callback revokes access, rotates the session, retires the host
  or cancels the request: recheck those states after the callback and enter no
  application function.
- The caller changes its number object while the original response is pending:
  execute and verify the original operation. Do not freeze the caller's object,
  treat its later edits as a new authorization or relax response validation.

## Changes and dispatch point

`server/executor.ts` captures a finite verified-identity freshness deadline and
reads the trusted clock again after all existing request/hash/Runtime Receipt
checks. After this last callback it checks current retirement, active/session
state, Grant deadline, session generation, retained verified-identity deadline
and cancellation. Only then does it check/decrement shared quota, increment
`engineCalls` and synchronously call `calculate(input)`.

The last time sample is also used for the App Receipt timestamp. An expired
Grant becomes inactive/expired as at initial admission; an identity-only
rejection does not consume quota. There is no recursive verification loop.
No trusted verifier or clock callback is invoked between these final reads and
function entry. This is the current single-process synchronous Calcu boundary,
not a generic database fence, sandbox or external status-writer ordering claim.
The identity check uses the verifier's retained freshness bound; it does not
introduce a second status round trip or new production identity infrastructure.

`server/localBackend.ts` copies and freezes the validated flat calculation value
before clock callbacks and transport suspension. Request hashes, body and
response comparison all use that owned snapshot. The caller remains mutable.
All correlation, echoed-input, output-hash and App Receipt checks remain; a
tampered response still fails after an already executed action and retains only
the accepted Runtime Receipt. Cancellation/output failure still does not undo
execution, refund quota or trigger automatic retry.

## Regression evidence

The original 11 tests have become
[26 regression cases](../server/handlerBindingCharacterization.test.ts):

- Grant expiry and identity-only freshness expiry inside the verifier reject
  with zero engine calls; refreshed valid identity evidence can use the same
  Grant's original three calls, proving the rejected attempt consumed no quota.
- Clock callback revoke/rotate/retire/cancel rejects before entry.
- Non-finite clock values and non-finite verified freshness reject; a throwing
  clock enters no handler and consumes no quota.
- A still-valid advanced clock succeeds once and supplies the App Receipt time;
  the identity verifier runs once per invocation, not recursively.
- Mutation inside verification, inside the mediator clock and after transport
  suspension preserves the original verified result without freezing the caller.
- Changed response operands still reject; shared quota, invalid output and
  post-entry cancellation accounting remain covered.

Two additional [HTTPS cases](../server/https.test.ts) exercise Grant and
identity-only deadline expiry through LocalBackend → actual TLS transport →
executor and observe zero engine calls. Existing fake-Codex/HTTPS activation,
identity, receipt, quota, retirement, exposure and UI suites remain the broader
boundary evidence. No live model task is needed for this correction.

Local gates passed: `npm run check` (311 Vitest tests plus 6 preflight and
13 bundle cases), `npm run build`, `npm run test:coverage` (88.50% lines),
`git diff --check`; 31 local file links resolve across the five changed documents.

## Unchanged scope and next decision

No manifest/schema/hash view, surface `0.1.2`, SDK source lock/vendor archive,
Grant/session envelope, public task API, UI, disclosure policy or receipt shape
changes. Previously captured receipts remain historical; a new valid action
uses its actual dispatch time. This is not production certification or proof of
natural-language intent.

P5-T9A-F merged in Calcu #21 as `3ae557dfbf5bf5973601155261c4f060ec3ee46e`
after successful verify/coverage CI and no unresolved threads.
P5-T9B/C still require an explicit go decision: these corrections do not prove
a real integration saving or a general host-owned dispatch adapter. Next,
use the [private real-host comparison plan](../SPECS/INPROGRESS/P5-T9A-H_Private_Host_Comparison.md)
and merged SDK #34 host contract before expanding SDK exports. Deadline tests
establish eligibility at the returned dispatch-time sample, not a physical
no-start-after-wall-clock-expiry guarantee.

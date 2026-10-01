# Calcu data handling: ADP-03

## Selected action contract

Calcu selects `redaction: {"mode":"none"}` and
`retention: {"mode":"user_managed"}` for `calculation.propose`.
The user chooses the agent and is responsible for how that agent handles
disclosed data. Calcu does not promise agent/provider deletion, training
restrictions, model unlearning or forensic erasure. Retention probes are not
required to qualify this selected action contract and will not be resumed.

The application still controls which data leaves its boundary. User-entered
task text is deliberate user disclosure; it does not authorize an agent to read
additional application data. Grant revocation prevents subsequent calls; it
does not retrieve previously disclosed information.

## Application-owned classification

| Class | Classification | Covered fields |
| --- | --- | --- |
| `calculation.content` | `sensitive` | Operator, operands and result, including echoed values and UI trace |
| `calculation.runtime_context` | `sensitive` | Subject/delegate, Grant/session/surface binding, correlation, execution and receipt metadata received by the mediator |
| `calculation.status` | `private` | Fixed statuses, action identifiers and allowlisted error codes |

These are Calcu policy choices, not mandatory ASP categories. The application
does not infer that arbitrary numbers are safe merely because they are numbers.
The class catalog and action exposure are part of surface version `0.1.1` and
its canonical hash. The existing SDK derives the exact exposure projection for
the trusted Grant request and selected Grant; editing the action declaration is
not permission to invoke it. An old surface binding is rejected before execution.

`server/exposure.ts` maps every leaf of the successful runtime envelope. Unknown
fields or unexpected nested values fail before serialization. Existing closed
schemas and receipt checks remain responsible for required fields, types and
integrity. HTTP errors contain only fixed, allowlisted codes, never raw errors.
This is a static upper-bound policy, not a dynamic sensitivity detector.

The `grant.revoked` control-event declaration remains a separate empty-class
source with `transient` retention and `delete_on_grant_end: true`. It is included
in the Grant source closure; its policy does not change action-output retention.
This demo does not implement general event delivery.

## Copies and evidence limits

| Copy | Owner and lifetime | Limit |
| --- | --- | --- |
| Textarea, submitted snapshot, result, trace and agent prose | Application UI state until replacement/unmount | Cancellation hides completion; no memory-erasure claim |
| Task host and adapter buffers | Local application/adapter execution scope | No deterministic JavaScript-memory wipe claim |
| Temporary work directory | Adapter; removed after child process termination | Fake-process cleanup tests are local hygiene evidence only |
| CLI/model/provider context | User-selected agent and provider | No deletion, retention or training assertion |
| Grant/identity records | Authoritative executor Map | Revocation disables authority; record minimization is separate debt |

Earlier `transient` action-output feasibility work is superseded by the
user-managed choice. Existing `retentionBoundary.test.ts` tests remain useful
for diagnostic redaction and temporary-directory cleanup; they do not establish
the selected agent's behavior. No live retention collector is needed.

ADP-03 remains open for the complete trusted selection/consent/current-authority
path and associated lifecycle decisions. Classifying outputs and deriving a
Grant projection do not by themselves establish those missing guarantees.

The demo now has [task-scoped access selection](./TASK_PERMISSIONS.md): explicit
action/disclosure choices, checked against a one-use server offer before issuance.
This addresses local selection wiring only, not authenticated principal,
durable consent or exact-action Human Approval. It does not resume retention probes.

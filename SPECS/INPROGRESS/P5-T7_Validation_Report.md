# P5-T7 Validation Report

**Result:** Bounded offline acceptance spike passed; no-go for production
adoption on the current single-action evidence. The authoring API remains
private and experimental.

## Scope and pins

- Calcu baseline: `5d1870b68dc172b6e6bb5453d3dde3352d19c4fc`.
- Prototype generator: agent-surface-js
  `03fd21c8bca70968b08e4585c14d1f6971978797`.
- Calcu's installed full-manifest validators: agent-surface-js artifact commit
  `4cd339796eb43eb9e6a15c934a23b20e9a3ec434`.
- No executor, Grant, identity, transport, SDK root export, or live Calcu
  execution behavior was changed.

## Checks

| Command | Result |
| --- | --- |
| `AGENT_SURFACE_JS_ROOT=../0AL/agent-surface-js npm run test:action-authoring-spike` | PASS. Runner verified pinned clean source, built the SDK/prototype, and the targeted full-manifest composition test passed. Handler call count: 0. |
| `npm run typecheck` | PASS. |
| `npx biome check package.json server/manifest.ts server/action-authoring-spike.test.ts scripts/run-action-authoring-spike.mjs` | PASS. |
| `npx vitest run server/action-authoring-spike.test.ts` (without private opt-in marker) | PASS; one test skipped during ordinary discovery. |
| `npm run test:action-authoring-spike` without `AGENT_SURFACE_JS_ROOT` | Expected fail-fast, exit 2 with an explicit setup message. |
| `git diff --check` | PASS. |

The complete test suite and CI were not run; this report records only the
targeted spike and proportional checks.

## Evidence and decision

The candidate preserves all non-action manifest fields and the event/receipt
schema resources, and passes `SurfaceSnapshot` and `OfflineProposalManifest`.
The generated input and output schema bodies equal the Calcu baseline after
removing only the prototype's redundant `operator.type: "string"` property.
That representation difference changes the input-schema hash and full surface
hash; therefore semantic schema acceptance is demonstrated, but hash/wire
equality is not.

The authoring layer replaces 45 physical lines of direct action/schema
manifest blocks in this one-action comparison. It still requires the full
application envelope, explicit scope/exposure/data-class policy, URI/hash
composition, and a substantial test adapter. This is not enough whole-app
reduction to justify production adoption for Calcu's single action. No existing
Grant or surface authority should be substituted based on this candidate hash.

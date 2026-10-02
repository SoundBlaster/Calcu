# Calcu-owned offline authoring candidate

Status: bounded experiment, not a runtime migration or conformance promotion.

The [candidate](../server/action-authoring-candidate.ts) describes Calcu's
existing four-operation proposal using the SDK's private authoring prototype.
It shares input fields with the output schema, infers TypeScript input/output
types and accepts an explicit existing business handler. Preparation does not
call or publish the handler. Application-owned data classes and exposure come
from `server/exposure.ts`, not the SDK's historical simplified Calcu fixture.

## Reproducible check

```sh
npm ci
npm run test:action-authoring-spike
```

The vendored development package and TypeBox are pinned in the lockfile;
provenance and license are in [vendor/README.md](../vendor/README.md).
No sibling SDK checkout or ambient build output is needed. Tests also run in
ordinary `npm run check` and CI, rather than silently skipping the experiment.

The tests assemble a complete candidate manifest from generated action/schema
fragments plus unchanged host-owned manifest fields, event and receipt schemas.
They check two issuer namespaces, deterministic descriptors, exact metadata and
disclosure parity, input/output type correspondence, all four operators,
closed-shape rejection, unsupported actions, JCS hashes and zero handler calls.
This is offline declaration validation, not live executor admission evidence.

## Compatibility result

The generator adds `type: string` beside the operator enum. For the current
four string literals the accepted JSON values are unchanged, but bytes and
schema/surface hashes differ. Tests allow exactly that keyword difference;
they do not normalize arbitrary schema differences or reuse the old hashes.
No scope, effect, classification, identity advertisement or host binding is
changed. `sqrt` is still absent.

The authoritative `server/manifest.ts`, runtime issuer, Grant/session lifecycle,
executor, transport and UI are unchanged. The candidate is imported only by its
offline test. Schema inference does not replace `validateCalculation` or its
finite-number/negative-zero business checks, and says nothing about interpreting
natural-language tasks correctly.

## Cost and remaining work

The candidate is about 55 physical lines including imports, types and handler wiring.
That is not a demonstrated total line-count saving over the current handwritten
action/schema blocks. The practical improvement is one shared field declaration
instead of repeated operator/operand schemas, derived types and SDK-owned URI,
hash and fragment preparation. Full host composition and policy remain explicit.
For now the production description and candidate deliberately coexist as a
comparison baseline; this experiment does not remove production duplication.

The next decision is whether to qualify a supported authoring module and then
switch Calcu's description in a reviewed migration that acknowledges new surface
hashes and requires fresh authority. Do not put the private dev package into the
live path or remove independent executor validation merely to reduce boilerplate.

## Local evidence (2026-10-01 UTC)

`npm run check`, `npm run build`, `npm run test:coverage` and
`git diff --check` passed: 235 Vitest tests, 6 preflight tests and 13 bundle
checks. A subsequent `npm ci` followed by the dedicated spike also passed all
3 authoring tests without a sibling checkout. No live Codex task was run.
`npm ci` reported 7 dependency advisories; this experiment does not address
the repository's broader dependency audit.

The subsequent CI failure and bounded lifecycle/diagnostic fixes are recorded
in [the cancellation retrospective](CI_CANCELLATION_RETRO.md). They do not
change the selected ASP contract or activate the offline candidate.

# Calcu-owned offline authoring candidate

Status: public SDK offline-consumer migration, 2026-10-02 UTC. Not a live
description migration or conformance promotion.

This report records the accepted Calcu #16 migration. The subsequent
[P5-T8A extraction and versioned preparation](LIVE_SDK_MANIFEST_PREPARATION.md)
shares its declaration with the new server snapshot factory and retains fixed
legacy fixtures. The selected live `0.1.1` snapshot is still unchanged.

The [candidate](../server/action-authoring-candidate.ts) describes Calcu's
existing four-operation proposal using `@0al/agent-surface/authoring` from
[SDK PR #32](https://github.com/0al-spec/agent-surface-js/pull/32).
It shares input fields with the output schema, infers TypeScript input/output
types and passes only declaration data to `OfflineActionInventory`. Neither the
candidate API nor the inventory accepts a handler or returns an execution
handle. Application-owned data classes and exposure come
from `server/exposure.ts`, not the SDK's historical simplified Calcu fixture.

## Reproducible check

```sh
npm ci
npm run test:action-authoring-spike
```

The vendored SDK package and TypeBox are pinned in the lockfile;
provenance and license are in [vendor/README.md](../vendor/README.md).
No sibling SDK checkout or ambient build output is needed. Tests also run in
ordinary `npm run check` and CI, rather than silently skipping the experiment.

The tests assemble a complete candidate manifest from generated action/schema
fragments plus unchanged host-owned manifest fields, event and receipt schemas.
They check two issuer namespaces, deterministic descriptors, exact metadata and
disclosure parity, input/output type correspondence, all four operators,
closed-shape rejection, unsupported actions, raw-JSON rejection, literal
pre-migration hashes and the descriptor-only prepared interface.
This is offline declaration validation, not live executor admission evidence.

## Compatibility result

The public module preserves the prior prototype's complete candidate manifest,
input hash and generated schema resources at both namespaces. The golden
digests were captured before changing dependencies, from Calcu `f4dfe285`
with prototype `307cbc693c98375f155d051fad2728e004749444`. They are literal
oracles in the test, not expectations recomputed by the replacement SDK.

| Issuer | Candidate input hash | Candidate surface hash |
| --- | --- | --- |
| `https://calcu.local` | `sha-256:RjICwvHoNxNlNu4qIDqYyU6tZzh5_dFrsbMSrFLDBs4` | `sha-256:nZyMGsHPo4siY2If0BAho0MRMX3C6wnKfSGcAX4iTr4` |
| `https://calcu.example.test` | `sha-256:6hWVDudXd9mAU-u_G3DVEAkq9OBT9Abka5XMeYPuSxE` | `sha-256:dOD2OhTj6PSVK_s1jEy08Abygonvd-AkPC0xmQLevSk` |

Tests additionally pin the complete candidate manifest's JCS SHA-256, both
generated resources as an ordered JCS array, and the untouched production
surface hashes. The event/receipt schemas and all host metadata remain explicit
and unchanged; the complete manifest still has exactly one action and scope.

Both generators add `type: string` beside the handwritten operator enum. For the current
four string literals the accepted JSON values are unchanged, but bytes and
schema/surface hashes differ. Tests allow exactly that keyword difference;
they do not normalize arbitrary schema differences or reuse the old hashes.
No scope, effect, classification, identity advertisement or host binding is
changed. `sqrt` is still absent. Raw duplicate keys, `-0`, overflowing numbers
and malformed JSON reject without a parse/stringify round trip.

The base SDK archive was updated to obtain its new public subpath. Its existing
validator implementations and spec-lock are byte-identical to the old archive;
see [package comparison](../vendor/README.md). At Calcu #16,
`server/manifest.ts`, runtime issuer, Grant/session lifecycle, executor,
transport and UI were unchanged. The historical candidate wrapper is still
imported only by its offline test; P5-T8A now imports the shared declaration
in the server manifest factory without activating its new snapshot.
Schema inference does not replace `validateCalculation` or its
finite-number/negative-zero business checks, and says nothing about interpreting
natural-language tasks correctly.

## Cost and remaining work

At Calcu #16, the candidate was 55 physical lines, versus 56 before migration, including imports,
inferred types and explicit policy. Replacing the two private lifecycle objects
with one public inventory removes handler wiring; the one-line reduction is not
evidence of a meaningful total integration-cost saving.
That is not a demonstrated total line-count saving over the current handwritten
action/schema blocks. The practical improvement is one shared field declaration
instead of repeated operator/operand schemas, derived types and SDK-owned URI,
hash and fragment preparation. Full host composition and policy remain explicit.
For now the production description and candidate deliberately coexist as a
comparison baseline; this experiment does not remove production duplication.

The private package is no longer an installation/runtime dependency; its archive
is retained as historical evidence. The practical outcome is a qualified public
module and removal of handler coupling, not a demonstrated total host-code saving.

The next separate task is the
[P5-T8 live description migration plan](../SPECS/INPROGRESS/P5-T8_Live_SDK_Manifest_Migration.md).
It must acknowledge
the already measured difference from the handwritten live surface, version and
pin immutable schema resources, and explicitly handle old authority: retain its
exact old snapshot or retire/revoke/fence it. Never reinterpret an old Grant
against new resources. Switching an offline generator without changing its output
does not itself require new authority. No live migration is authorized by this
consumer update, and independent executor validation remains mandatory.

## Public-module migration evidence (2026-10-02 UTC)

- Clean `npm ci --no-audit --no-fund` followed by the dedicated offline check:
  all 3 authoring tests passed using only the installed vendored package.
- `npm run check`: 237 Vitest tests, 6 preflight tests and 13 bundle tests passed.
- `npm run build`: production client build and browser-bundle isolation passed.
- `npm run test:coverage`: 237 tests passed; line coverage 86.39% (threshold 80%).
- `git diff --check`: passed.
- Fresh `npm pack` (including its build) at the clean merged SDK commit reproduced
  the pinned archive byte-for-byte. The historical SDK/prototype archives remain
  unchanged. Both candidate namespaces retained their literal hashes above.

Local checks used Node 26.5.0 and UTC; CI checks Node 22. The installation
reported pre-existing npm lifecycle-script policy warnings for esbuild/fsevents;
no approval policy was changed, and the build succeeded. This run did not perform
a dependency-advisory audit or a live Codex task. No credentials were issued or
old sessions migrated by this authoring check.

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

# P5-T8A — SDK manifest preparation (not activated)

Status: preparation implemented, 2026-10-02 UTC. The demo still selects the
legacy `0.1.1` manifest. No old Grant/session is migrated and no new live
conformance claim is made.

## One declaration, explicit host composition

[`calculation-declaration.ts`](../server/calculation-declaration.ts) owns the
closed input/output schemas and the existing proposal/exposure metadata. Both
the historical offline comparison and `prepareSdkCalcuSurface()` use this
`OfflineActionInventory`. Neither accepts a business handler. TypeScript checks
the inferred input and output against the existing Calcu application types.

[`manifest.ts`](../server/manifest.ts) composes the generated fragments with
explicit host-owned identity, authorization, scope, events, receipts and
revocation fields. It validates the complete document through
`OfflineProposalManifest` before returning a prepared snapshot. The candidate
has version `0.1.2` and action schemas under `<issuer>/schemas/0.1.2/`.
The version is fixed by the trusted factory, not a caller-provided option.

The private shared builder retains the handwritten legacy action/schema branch
for `prepareCalcuSurface()`. That factory remains the default in the demo,
permission broker and executor until P5-T8B. Preparing either description does
not issue authority, authenticate identity or execute a calculation.

## Immutable legacy baseline and exact delta

The [local](../server/fixtures/legacy-surface-0.1.1.local.json) and
[example](../server/fixtures/legacy-surface-0.1.1.example.json) fixtures were
captured from Calcu `7f837fd1eaad4dec78b3c7f612e52a8fa7a870a4` before changing
the builder. They retain the full manifest, all four schema resources and the
identity advertisement. Tests pin fixture/manifest/resource JCS digests and the
original constructed JSON byte digests. They also compare the still-selected
legacy factory's serialization to the captured artifacts.

The historical offline comparison now reads these fixtures instead of calling
the evolving live factory. Its previously accepted prototype goldens remain
unchanged; future live activation cannot silently redefine that oracle.

The new candidate changes only:

- `surface_version` to `0.1.2` and the resulting `surface_hash`;
- the two action schema URIs and their matching `$id` values;
- `type: string` beside the existing four-string operator enum;
- the input schema hash, computed from the new schema identity and contents.

Both event/receipt schema URIs and contents stay byte-identical. No scope,
operation, effect, classification, disclosure policy, identity advertisement or
host endpoint changes. `sqrt` remains unsupported. Calcu has no manifest/schema
GET publication service; this slice adds none and does not overwrite a resource
served under an existing URI.

| Issuer | New surface hash | New input schema hash |
| --- | --- | --- |
| `https://calcu.local` | `sha-256:htv_7BJWC1m1In23qz09pAVnBpAtqP1G2AADxACsy1I` | `sha-256:qrE98zTK6reOyfYvqgT56niz2RUNSsslLyW7xhUxFRI` |
| `https://calcu.example.test` | `sha-256:b68eUcnsKNPp6T7GjWZNpSfo5Yp-FiDKVC70iIt9Vrg` | `sha-256:FvMBrfhj_ioR9YM3IktP6ksAu9AtQFIOZMEIHZJxW2I` |

[`sdk-manifest.test.ts`](../server/sdk-manifest.test.ts) pins complete manifest,
ordered resource-set and individual schema JCS SHA-256 digests at both
namespaces. It compares every remaining host/action field to the fixed legacy
baseline, rather than accepting arbitrary normalized differences.

## Dependency and execution boundaries

TypeBox `0.34.52` is now an explicit runtime dependency because the server
manifest module imports the shared declaration. The SDK archive, its source
lock and all other dependency versions/integrities are unchanged. A clean
`npm ci` needs only the repository's vendored SDK and registry dependencies.
The browser still imports no server manifest, TypeBox authoring or ASP authority.

Tests cover all four operations, closed input/output shapes, unsupported actions,
duplicate keys, negative zero, overflow, malformed JSON, invalid issuer/app
composition, missing/substituted/duplicate referenced resources, mismatched
identity projection and a stale supplied surface hash. Preparation and schema
validation do not call the application calculation function. This is static
qualification, not admission of a new-version HTTPS request or verification of
natural-language intent. Existing engine and admission checks are unchanged.

## Cost and remaining transition

Before this extraction, `manifest.ts` plus the offline candidate occupied 406
physical lines (351 + 55). The corresponding manifest, shared declaration and
historical wrapper now occupy 442 (376 + 55 + 11). This preparatory slice adds
36 lines; it does not demonstrate a code-size saving. Immutable fixtures/tests
are evidence, not live authoring duplication. P5-T8B will remove the handwritten
live branch and measure the resulting composition footprint again.

Next: [P5-T8B](../SPECS/INPROGRESS/P5-T8_Live_SDK_Manifest_Migration.md), selecting
the new snapshot consistently across permissions, issuance, admission and
receipts, with explicit authority retirement and bounded host restart. Until
that transition is implemented, neither new authority issuance nor new-version
live behavior is established by these tests.

## Validation

Local results on 2026-10-02 UTC:

- Clean `npm ci --no-audit --no-fund`: passed with the unchanged existing
  esbuild/fsevents lifecycle-script policy warnings; no policy was changed.
- `npm run check`: format, lint, typecheck, 249 Vitest tests, 6 preflight tests
  and 13 bundle-guard tests passed.
- `npm run build`: production build and browser isolation passed (3 assets).
- `npm run test:coverage`: 249 tests passed; line coverage 86.74% (gate 80%).
- `git diff --check`: passed; all 40 local links in the changed docs resolve.

Node 26.5.0 was used locally, with UTC for the final gates; CI checks Node 22.
CI remains a separate check on the pushed commit. No manual live Codex task or
dependency-advisory audit was run in this preparation slice.

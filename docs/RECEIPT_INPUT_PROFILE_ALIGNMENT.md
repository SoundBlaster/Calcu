# Receipt reason and input-profile alignment

This focused change aligns the existing Calcu receipt evidence with the selected
ASP contract. It does not qualify full receipt delivery or production identity.

- Both Runtime and App policy decisions use `policy_allowed`. Their distinct
  enforcers, policy identifiers and matched rules remain intact.
- Receipt verification rejects legacy or other unselected allow reason codes,
  including self-consistent, rehashed evidence.
- `calculation.propose` explicitly declares `input_hash_profile: asp-jcs-sha-256`.
  Existing invocation input hashing remains application-owned.
- Surface version is `0.1.3`, with versioned action schema URIs and new literal
  manifest/schema hash oracles. Immutable `0.1.1` fixtures and historical
  `0.1.2` activation reports remain unchanged.
- The SDK archive pins candidate commit `e5321deab9231782cb375cd7dc4851daad625124`
  from SDK PR #39. Its ASP source lock is unchanged. This is not a registry release.

Boundary regression tests reject an unselected Runtime reason before engine
execution and an unselected App reason before accepting its returned result.
The latter necessarily follows application execution: verification cannot undo
an already performed action. This surface remains proposal-only arithmetic.

No new actions, scopes, approval paths or agent authority are introduced.
Full receipt-channel delivery qualification remains a separate follow-up.

## Local validation (2026-10-03 UTC)

- `npm run check`: formatting, lint, TypeScript, 315 Vitest tests,
  six preflight tests and 13 browser-isolation tests passed.
- `npm run build`: client build and browser bundle isolation passed.
- `npm run test:coverage`: 315 tests passed; 88.51% line coverage.
- `git diff --check` passed.
- SDK candidate check: 615 unit tests, packed consumers and 335 exchange
  vectors passed. Calcu exposed and now tests the semantic Grant bridge's
  optional action-field handling; standalone manifest validation was insufficient.

These are deterministic local tests, not a new live Codex smoke test or an
independent interoperability claim.

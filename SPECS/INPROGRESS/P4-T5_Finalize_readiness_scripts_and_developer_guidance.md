# P4-T5: Finalize readiness scripts and developer guidance

## Goal

Document the repository workflow needed to run, lint, test, type-check, and preview the calculator app without requiring guesswork.

## Scope

- Audit the current package scripts for the supported development flow.
- Add minimal repo-level guidance that points to the exact commands developers should run.
- Avoid script churn unless a clear gap exists.

## Inputs

- Existing `package.json` scripts.
- Existing build, lint, typecheck, and test setup from earlier phases.

## Deliverables

- A root-level README or equivalent usage guide.
- Validation report documenting the readiness check.

## Acceptance Criteria

- Developers can identify how to run, lint, build, type-check, and test the app without guesswork.
- Script names are consistent with the configured tooling.
- The documented workflow reflects the implemented stack accurately.

## Dependencies

- P1-T2: Biome scripts.
- P1-T3: Vitest entrypoints.
- P4-T2: Engine test coverage.

## Notes

- Prefer concise documentation that points straight to the existing scripts.
- Add package script changes only if a genuine gap appears during the audit.

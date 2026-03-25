# P4-T8: Establish repository quality gates and CI reporting

## Overview

This task formalizes the repository's quality gates and CI reporting for the calculator app. The codebase already contains the CI and coverage workflows, package-level verification scripts, and README badges; this PRD records the intended deliverables, acceptance criteria, and validation surface for the completed work.

## Deliverables

- GitHub Actions workflows for CI and coverage reporting under `.github/workflows/`
- README badges that surface CI and coverage status
- Repository scripts that support formatting, linting, type checking, test execution, and coverage collection
- Validation report summarizing the gate results for the current repository state

## Acceptance Criteria

- Lint, format, test, typecheck, and coverage commands are defined in the project scripts
- CI runs formatting, linting, type checking, and tests on pull requests and pushes to `main`
- Coverage is generated in CI and surfaced as a badge and/or artifact
- README exposes visible CI and coverage badges and the common local commands
- The validation report captures the exact verification commands and their outcomes

## Dependencies

- `P1-T2` Configure Biome and project scripts
- `P1-T3` Configure Vitest and test entrypoints
- `P4-T2` Write engine tests for standard and scientific behavior
- `P4-T5` Finalize readiness scripts and developer guidance

## Validation Surface

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run test:coverage`
- CI workflow definitions in `.github/workflows/ci.yml` and `.github/workflows/coverage.yml`
- README badge and command references

---
**Archived:** 2026-03-25
**Verdict:** PASS

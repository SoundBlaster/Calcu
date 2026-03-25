# Task PRD — P1-T2 Configure Biome and project scripts

## Objective

Make the project’s formatting and linting entrypoints explicit and repeatable. The repository already has a valid Biome config and basic scripts; this task tightens the script surface so contributors and FLOW validation can rely on a clear set of commands for formatting, linting, and combined checks.

This task stays within foundation/tooling scope. It does not change calculator behavior, UI structure, or styling output.

## Deliverables

- `biome.json` reviewed and adjusted if needed for repository-wide checks
- `package.json` scripts for format, format validation, lint, and a combined check command
- `SPECS/INPROGRESS/P1-T2_Validation_Report.md`

## Acceptance Criteria

- Biome config is valid for the current repository layout
- `npm run format` writes formatting changes
- `npm run format:check` verifies formatting without writing files
- `npm run lint` runs Biome checks successfully
- `npm run check` provides a single repository-level validation command
- All commands succeed on the current scaffold without requiring app logic changes

## Test-First Plan

1. Run the current scripts to confirm the baseline and capture any missing entrypoints.
2. Add or adjust package scripts so format and check modes are separated cleanly.
3. Re-run lint, format validation, and the combined check command.
4. Confirm TypeScript and app build still succeed so the tooling changes do not break the scaffold.

## Execution Plan

### Phase 1: Baseline audit

Inputs:
- `package.json`
- `biome.json`
- current source tree

Outputs:
- a clear list of missing or redundant tooling entrypoints

Verification:
- inspect script coverage against the workplan requirement for formatting and linting

### Phase 2: Script and config update

Inputs:
- current Biome config
- selected repo conventions from `.flow/params.yaml`

Outputs:
- updated `package.json` scripts
- any necessary Biome config refinements

Verification:
- `npm run format:check`
- `npm run lint`
- `npm run check`

### Phase 3: Validation and reporting

Inputs:
- updated scripts/config

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run test -- --run`
- `npm run typecheck`
- `npm run build`

## Notes

- Update the workplan only if the task status or references need clarification after implementation.
- Keep the final report focused on the actual commands run and whether the repository now has stable tooling entrypoints.

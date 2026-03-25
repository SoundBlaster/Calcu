# Task PRD — P1-T3 Configure Vitest and test entrypoints

## Objective

Make the project’s unit-testing entrypoints explicit and stable. Vitest is already functioning through `vite.config.ts`, but this task separates the test-specific configuration into its own file, establishes a small test setup area, and keeps the initial test discovery path ready for calculator engine work.

The goal is not to add calculator behavior tests yet. The goal is to ensure the repository has a clear, documented, and maintainable Vitest entrypoint before engine development begins.

## Deliverables

- `vitest.config.ts`
- `src/test/setup.ts` or an equivalent test setup entrypoint
- Initial test directory structure under `src/test/` or `tests/`
- Existing smoke test retained or moved into the new structure
- `SPECS/INPROGRESS/P1-T3_Validation_Report.md`

## Acceptance Criteria

- `npm run test` runs Vitest successfully
- Vitest discovers at least one test file
- Test-specific configuration is separated from the app build config
- A reusable setup entrypoint exists for future engine and component tests
- The scaffold continues to pass typecheck, lint, and build gates

## Test-First Plan

1. Confirm the current test command and file discovery behavior.
2. Add a dedicated `vitest.config.ts` that mirrors the existing test runtime settings.
3. Add a small setup file and route Vitest through it.
4. Re-run Vitest, lint, typecheck, and build to prove the split config did not regress the scaffold.

## Execution Plan

### Phase 1: Baseline capture

Inputs:
- current `vite.config.ts`
- current smoke test file
- `package.json` scripts

Outputs:
- explicit understanding of which test settings currently live in the app config

Verification:
- `npm run test -- --run`

### Phase 2: Extract test entrypoints

Inputs:
- current Vite config test block
- chosen test setup path

Outputs:
- dedicated `vitest.config.ts`
- setup file and initial test directory

Verification:
- Vitest still discovers and runs the smoke test

### Phase 3: Validate and report

Inputs:
- updated config and setup files

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes

- If the existing smoke test is moved, keep the test purpose simple and discovery-friendly.
- Do not introduce extra testing libraries unless the task needs them.

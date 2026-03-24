# PRD: P1-T1 — Add `task_system` section to `.flow/params.yaml`

## Objective Summary

Introduce a portable task-system configuration contract so Flow can describe task tracking integration without hardcoding one vendor. The task will add a lightweight `task_system` section to `.flow/params.yaml`, then align command docs and setup guidance to clarify what belongs in params versus runtime Skills. This keeps Flow methodology-first while enabling GitHub/Jira/Linear/none deployments with one normalized shape.

## Deliverables

1. `.flow/params.yaml` updated with minimal required key `task_system.kind` and optional reference/linkage fields.
2. `SPECS/COMMANDS/FLOW.md` and related command docs updated to reference this contract and describe skill/runtime boundaries.
3. Validation/contract note documenting required vs optional keys in existing docs to keep implementation lightweight and unambiguous.

## Acceptance Criteria

- `task_system.kind` supports exactly `github|jira|linear|none` in documentation and sample config.
- Optional fields stay intentionally lightweight (e.g., `project_key`, `task_url_template`) and avoid API secrets.
- Command docs state task metadata ownership split:
  - Params = static contract/defaults.
  - Skills/runtime adapters = tool-specific retrieval/execution behavior.
- Updated docs are internally consistent and reference the same key names.

## Test-First Plan

Before making edits, verify baseline quality gates from `.flow/params.yaml`:

1. Run `make lint` to confirm markdown/shell checks pass before changes.
2. Run `make test` to ensure repo checks are green before and after modifications.
3. Re-run both commands after edits and capture outcomes in validation report.

## Execution Plan (Hierarchical)

### Phase A — Contract definition
- **Input:** Existing `.flow/params.yaml`, `SPECS/COMMANDS/FLOW.md`.
- **Output:** New `task_system` structure with required/optional keys.
- **Verification:** Key names and allowed values explicitly documented.

### Phase B — Documentation alignment
- **Input:** SELECT/PLAN/ARCHIVE/FLOW docs.
- **Output:** Clear references to params vs Skills boundary.
- **Verification:** Grep/inspection confirms consistent wording and field names.

### Phase C — Validation evidence
- **Input:** Updated docs/config.
- **Output:** `SPECS/INPROGRESS/P1-T1_Validation_Report.md` with command results and checklist.
- **Verification:** Quality gate commands executed and report committed.

## Decision Points and Constraints

- Keep contract deliberately minimal to avoid overfitting to one tracker.
- Do not add executable integrations in this task; documentation-only abstraction.
- Preserve backward readability for existing Flow users by placing `task_system` after current top-level sections.

## Notes

After implementation, update `SPECS/Workplan.md` task status and archive artifacts per FLOW sequence.

# FU-T1: Normalize calculator task IDs against existing archive history

## Goal

Introduce a clear task ID namespace policy so calculator follow-up work and archive references remain unambiguous even though the repository contains legacy duplicate task IDs.

## Scope

- Document the canonical task ID policy for calculator work.
- Update archive-facing workflow artifacts so historical task references are easy to disambiguate.
- Keep the change limited to workflow documentation and archive metadata.

## Inputs

- Existing task history in `SPECS/Workplan.md`.
- Existing archive index in `SPECS/ARCHIVE/INDEX.md`.

## Deliverables

- A documented task ID namespace policy in the workplan.
- Any archive index notes needed to clarify historical duplicate IDs.
- Validation report confirming the workflow docs are consistent.

## Acceptance Criteria

- Archived calculator tasks are uniquely identifiable without ambiguous duplicate task IDs.
- `next.md`, archive entries, and future PRDs can reference calculator tasks unambiguously.
- The chosen naming policy is documented in repository workflow artifacts.

## Dependencies

- none

## Notes

- Prefer a policy note and archive guidance over mass-renaming historical records.
- Preserve the existing archive history while making the canonical lookup path explicit.

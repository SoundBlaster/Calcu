# P4-T3: Verify visual stability across supported viewport sizes

## Goal

Validate that the calculator keeps stable proportions, spacing, and hierarchy across the supported viewport classes without relying on auto-scaled layout behavior.

## Scope

- Inspect the rendered calculator at narrow portrait, mobile landscape, tablet, and desktop widths.
- Confirm that portrait and landscape layouts remain intentionally designed and readable.
- Adjust CSS only if the visual pass reveals instability or weak layout behavior.

## Inputs

- Existing responsive calculator layout under `src/features/calculator/components/`.
- Tokenized sizing and color contracts under `src/features/calculator/config/` and `src/features/calculator/styles/`.

## Deliverables

- Visual QA notes in `SPECS/INPROGRESS/`.
- CSS tuning updates if a viewport-specific issue is found.

## Acceptance Criteria

- Buttons keep consistent proportions and alignment across the target viewport classes.
- Portrait and landscape each read as intentional layouts rather than scaled copies.
- Extra width does not produce an undersized calculator region.

## Dependencies

- P3-T5: Compose the calculator feature and viewport switching.

## Notes

- Use the current calculator screens as the reference point for the pass.
- Prefer notes over code changes when the layout already behaves correctly.

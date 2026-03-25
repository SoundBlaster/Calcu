## REVIEW REPORT — P2-T5 parentheses and display formatting

**Scope:** main..HEAD
**Files:** 13

### Summary Verdict
- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues

None.

### Secondary Issues

None.

### Architectural Notes

- Parentheses handling is kept inside the reducer with a dedicated stack, which fits the existing immediate-execution architecture without introducing a full expression editor.
- Display formatting is now centralized in `src/features/calculator/lib/formatDisplay.ts`, so React rendering stays focused on composition instead of number munging.

### Tests

- The task adds coverage for grouped arithmetic, nested parentheses, long numeric values, decimal formatting, and the `Error` token.
- Validation passed with `npm run lint`, `npm run test -- --run`, `npm run typecheck`, `npm run build`, and `npm run check`.
- The full Vitest suite passed with 53 tests.

### Next Steps

- FOLLOW-UP is skipped because there are no actionable findings.
- Archive this review report under `SPECS/ARCHIVE/_Historical/`.

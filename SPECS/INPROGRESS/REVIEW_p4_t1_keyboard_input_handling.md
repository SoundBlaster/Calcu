## REVIEW REPORT — P4-T1 Keyboard Input Handling

**Scope:** main..HEAD
**Files:** 13

### Summary Verdict
- [ ] Approve
- [ ] Approve with comments
- [x] Request changes
- [ ] Block

### Critical Issues
- None.

### Secondary Issues
- [Medium] The global `keydown` listener will still process `Enter` when a calculator button has focus, because `shouldIgnoreCalculatorKeyboardEvent` only excludes editable form controls. Native button activation already dispatches a click on `Enter`, so this can double-dispatch the calculator action when focus is on a button. Guard the listener against interactive button targets for Enter, or scope the global handler so native button activation remains single-source-of-truth. Files: `src/features/calculator/components/useCalculatorKeyboardInput.ts:12-24`, `src/features/calculator/lib/keyboardInput.ts:58-59`.

### Architectural Notes
- The keyboard handling is otherwise cleanly separated: key translation is pure, and the hook only dispatches reducer actions.
- The reducer-side `Backspace` handling keeps calculator state changes in one place, which is the right boundary for this feature.

### Tests
- `npm run test -- --run` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- Coverage is not separately configured in `.flow/params.yaml`, so no dedicated coverage run was available for this task.

### Next Steps
- Add a guard for focused calculator buttons so `Enter` does not double-trigger the equals action.
- Add a regression test that exercises keyboard input while a calculator button has focus.

# P4-T7 Validation Report

## Summary

Prevented the global keyboard listener from double-dispatching when `Enter` is pressed on a focused calculator button, and added regression coverage for the focused equals button path.

## Changes

- Updated `src/features/calculator/lib/keyboardInput.ts` to ignore `Enter` events originating from a focused `button`.
- Added a calculator integration regression in `src/features/calculator/components/Calculator.test.tsx` that simulates focused-button Enter handling.

## Validation

- `npm run check` passed

## Notes

- The new guard is narrow and does not affect non-button keyboard shortcuts.
- The regression confirms the calculator result remains stable after the native button activation path and the global keydown listener both see Enter.

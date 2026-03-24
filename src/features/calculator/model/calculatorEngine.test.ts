import { describe, expect, it } from 'vitest';
import type { CalculatorKeyActionId } from '../config';
import { reduceCalculatorState } from './calculatorEngine';
import { initialCalculatorState } from './calculatorTypes';

function runActions(actions: ReadonlyArray<CalculatorKeyActionId>) {
  return actions.reduce(reduceCalculatorState, initialCalculatorState);
}

describe('reduceCalculatorState', () => {
  it('resolves standard arithmetic input', () => {
    const state = runActions([
      'digit:1',
      'binary:add',
      'digit:2',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('3');
  });

  it('supports repeated equals for the last binary operation', () => {
    const state = runActions([
      'digit:2',
      'binary:add',
      'digit:3',
      'command:equals',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('8');
  });

  it('applies percent using the stored operand when a binary operator is pending', () => {
    const state = runActions([
      'digit:2',
      'digit:0',
      'digit:0',
      'binary:add',
      'digit:1',
      'digit:0',
      'command:percent',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('220');
  });

  it('toggles second mode through the reducer', () => {
    const state = runActions(['mode:toggle-second']);

    expect(state.secondMode).toBe(true);
  });
});

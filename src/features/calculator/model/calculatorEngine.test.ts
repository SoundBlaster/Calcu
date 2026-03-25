import { describe, expect, it } from 'vitest';
import type { CalculatorKeyActionId } from '../config';
import { reduceCalculatorState } from './calculatorEngine';
import { initialCalculatorState } from './calculatorTypes';

function runActions(actions: ReadonlyArray<CalculatorKeyActionId>) {
  return actions.reduce(reduceCalculatorState, initialCalculatorState);
}

describe('reduceCalculatorState', () => {
  it('resets all state on all-clear', () => {
    const state = runActions([
      'digit:9',
      'binary:add',
      'digit:1',
      'command:all-clear',
    ]);

    expect(state).toEqual(initialCalculatorState);
  });

  it('ignores duplicate decimal entry in a single number', () => {
    const state = runActions([
      'digit:1',
      'command:decimal',
      'digit:2',
      'command:decimal',
      'digit:3',
    ]);

    expect(state.displayValue).toBe('1.23');
  });

  it('toggles sign for a non-zero number', () => {
    const state = runActions(['digit:5', 'command:toggle-sign']);

    expect(state.displayValue).toBe('-5');
  });

  it('chains binary operators through immediate execution', () => {
    const state = runActions([
      'digit:1',
      'binary:add',
      'digit:2',
      'binary:add',
      'digit:3',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('6');
  });

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

  it('deletes the last active digit when backspace is applied', () => {
    const state = runActions(['digit:1', 'digit:2', 'command:backspace']);

    expect(state.displayValue).toBe('1');
  });

  it('ignores backspace after a resolved result has been produced', () => {
    const state = runActions([
      'digit:1',
      'binary:add',
      'digit:2',
      'command:equals',
      'command:backspace',
    ]);

    expect(state.displayValue).toBe('3');
  });
});

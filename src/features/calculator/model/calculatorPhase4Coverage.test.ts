import { describe, expect, it } from 'vitest';
import type { CalculatorKeyActionId } from '../config';
import { reduceCalculatorState } from './calculatorEngine';
import { initialCalculatorState } from './calculatorTypes';

function runActions(actions: ReadonlyArray<CalculatorKeyActionId>) {
  return actions.reduce(reduceCalculatorState, initialCalculatorState);
}

describe('phase 4 engine coverage', () => {
  it('covers standard arithmetic and repeated equals behavior', () => {
    const state = runActions([
      'digit:1',
      'binary:add',
      'digit:2',
      'command:equals',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('5');
    expect(state.lastBinaryOperator).toBe('add');
    expect(state.lastBinaryOperand).toBe(2);
  });

  it('covers percent semantics and memory recall flows', () => {
    const state = runActions([
      'digit:2',
      'digit:0',
      'digit:0',
      'binary:add',
      'digit:1',
      'digit:0',
      'command:percent',
      'command:equals',
      'memory:add',
      'digit:1',
      'memory:recall',
    ]);

    expect(state.displayValue).toBe('220');
    expect(state.memoryValue).toBe(220);
    expect(state.replaceDisplayOnNextDigit).toBe(true);
  });

  it('covers scientific functions, angle modes, and second mode toggling', () => {
    const state = runActions([
      'mode:angle-deg',
      'digit:9',
      'digit:0',
      'unary:sin',
      'mode:toggle-second',
    ]);

    expect(state.displayValue).toBe('1');
    expect(state.angleMode).toBe('deg');
    expect(state.secondMode).toBe(true);
  });

  it('covers parentheses handling and stable error recovery', () => {
    const state = runActions([
      'group:open-parenthesis',
      'digit:2',
      'binary:add',
      'digit:3',
      'group:close-parenthesis',
      'binary:multiply',
      'digit:4',
      'command:equals',
      'binary:divide',
      'digit:0',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('Error');
    expect(state.errorState).toBe(true);
    expect(state.errorKind).not.toBeNull();
  });
});

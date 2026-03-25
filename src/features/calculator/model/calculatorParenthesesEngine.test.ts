import { describe, expect, it } from 'vitest';
import type { CalculatorKeyActionId } from '../config';
import { reduceCalculatorState } from './calculatorEngine';
import { initialCalculatorState } from './calculatorTypes';

function runActions(actions: ReadonlyArray<CalculatorKeyActionId>) {
  return actions.reduce(reduceCalculatorState, initialCalculatorState);
}

describe('parenthesis reducer behavior', () => {
  it('evaluates grouped arithmetic before continuing the outer expression', () => {
    const state = runActions([
      'group:open-parenthesis',
      'digit:2',
      'binary:add',
      'digit:3',
      'group:close-parenthesis',
      'binary:multiply',
      'digit:4',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('20');
  });

  it('supports nested parentheses in the scientific expression stack', () => {
    const state = runActions([
      'digit:2',
      'binary:multiply',
      'group:open-parenthesis',
      'digit:3',
      'binary:add',
      'group:open-parenthesis',
      'digit:4',
      'binary:subtract',
      'digit:1',
      'group:close-parenthesis',
      'group:close-parenthesis',
      'command:equals',
    ]);

    expect(state.displayValue).toBe('12');
  });
});

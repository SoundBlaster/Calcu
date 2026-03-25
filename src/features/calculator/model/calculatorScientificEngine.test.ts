import { describe, expect, it } from 'vitest';
import type { CalculatorKeyActionId } from '../config';
import { reduceCalculatorState } from './calculatorEngine';
import { initialCalculatorState } from './calculatorTypes';

function runActions(actions: ReadonlyArray<CalculatorKeyActionId>) {
  return actions.reduce(reduceCalculatorState, initialCalculatorState);
}

describe('scientific reducer behavior', () => {
  it.each([
    ['square', ['digit:4', 'unary:square'] as const, 16],
    ['reciprocal', ['digit:4', 'unary:reciprocal'] as const, 0.25],
    ['factorial', ['digit:5', 'unary:factorial'] as const, 120],
    ['base-2 logarithm', ['digit:8', 'unary:log-2'] as const, 3],
    ['natural exponent', ['digit:2', 'unary:exp-e'] as const, Math.exp(2)],
  ])('applies %s as an immediate unary operation', (_label, actions, expected) => {
    const state = runActions(actions);

    expect(Number.parseFloat(state.displayValue)).toBeCloseTo(expected);
  });

  it('respects angle mode for trig and inverse trig operations', () => {
    const degState = runActions([
      'mode:angle-deg',
      'digit:9',
      'digit:0',
      'unary:sin',
    ]);

    expect(degState.displayValue).toBe('1');

    const inverseDegState = runActions([
      'mode:angle-deg',
      'digit:1',
      'unary:arcsin',
    ]);

    expect(inverseDegState.displayValue).toBe('90');

    const radState = runActions(['digit:1', 'unary:arctan']);

    expect(Number.parseFloat(radState.displayValue)).toBeCloseTo(Math.PI / 4);
  });

  it('evaluates scientific binary operators through the immediate-execution model', () => {
    const powerState = runActions([
      'digit:2',
      'binary:power',
      'digit:3',
      'command:equals',
    ]);

    expect(powerState.displayValue).toBe('8');

    const reversedPowerState = runActions([
      'digit:2',
      'binary:y-to-x',
      'digit:3',
      'command:equals',
    ]);

    expect(reversedPowerState.displayValue).toBe('8');

    const rootState = runActions([
      'digit:8',
      'binary:root',
      'digit:3',
      'command:equals',
    ]);

    expect(rootState.displayValue).toBe('2');

    const logBaseState = runActions([
      'digit:8',
      'binary:log-base',
      'digit:2',
      'command:equals',
    ]);

    expect(logBaseState.displayValue).toBe('3');
  });

  it('inserts constants and scientific notation into the active display entry', () => {
    const constantState = runActions(['constant:e']);

    expect(Number.parseFloat(constantState.displayValue)).toBeCloseTo(Math.E);
    expect(constantState.replaceDisplayOnNextDigit).toBe(true);

    const piState = runActions([
      'digit:2',
      'binary:add',
      'constant:pi',
      'command:equals',
    ]);

    expect(Number.parseFloat(piState.displayValue)).toBeCloseTo(2 + Math.PI);

    const scientificNotationState = runActions([
      'digit:1',
      'command:scientific-notation',
      'digit:2',
      'binary:add',
      'digit:1',
      'command:equals',
    ]);

    expect(scientificNotationState.displayValue).toBe('101');

    const randomState = runActions(['constant:rand']);
    const randomValue = Number.parseFloat(randomState.displayValue);

    expect(randomValue).toBeGreaterThanOrEqual(0);
    expect(randomValue).toBeLessThan(1);
  });

  it('enters Error for invalid scientific input domains', () => {
    const reciprocalOfZero = runActions(['digit:0', 'unary:reciprocal']);

    expect(reciprocalOfZero.displayValue).toBe('Error');

    const invalidLog = runActions([
      'digit:0',
      'binary:log-base',
      'digit:2',
      'command:equals',
    ]);

    expect(invalidLog.displayValue).toBe('Error');

    const tangentSingularity = runActions([
      'mode:angle-deg',
      'digit:9',
      'digit:0',
      'unary:tan',
    ]);

    expect(tangentSingularity.displayValue).toBe('Error');
  });
});

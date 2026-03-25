import { describe, expect, it } from 'vitest';
import { initialCalculatorState } from './calculatorTypes';

describe('calculatorTypes', () => {
  it('defines the initial calculator state with memory and error metadata', () => {
    expect(initialCalculatorState).toEqual({
      angleMode: 'rad',
      displayValue: '0',
      errorKind: null,
      errorMessage: null,
      errorState: false,
      lastBinaryOperand: null,
      lastBinaryOperator: null,
      memoryValue: 0,
      parenthesisStack: [],
      pendingBinaryOperator: null,
      replaceDisplayOnNextDigit: false,
      secondMode: false,
      storedValue: null,
    });
  });
});

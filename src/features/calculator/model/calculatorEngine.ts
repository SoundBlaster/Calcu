import type { CalculatorKeyActionId } from '../config';
import {
  type CalculatorBinaryOperator,
  type CalculatorState,
  initialCalculatorState,
} from './calculatorTypes';

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.parseFloat(value.toPrecision(12)).toString();
}

function setErrorState(state: CalculatorState): CalculatorState {
  return {
    ...state,
    displayValue: 'Error',
    errorState: true,
    lastBinaryOperand: null,
    lastBinaryOperator: null,
    pendingBinaryOperator: null,
    replaceDisplayOnNextDigit: true,
    storedValue: null,
  };
}

function parseDisplayValue(displayValue: string) {
  return Number.parseFloat(displayValue);
}

function applyBinaryOperator(
  leftValue: number,
  operator: CalculatorBinaryOperator,
  rightValue: number,
) {
  switch (operator) {
    case 'add':
      return leftValue + rightValue;
    case 'divide':
      return rightValue === 0 ? null : leftValue / rightValue;
    case 'multiply':
      return leftValue * rightValue;
    case 'subtract':
      return leftValue - rightValue;
  }
}

function updateDisplayValue(
  state: CalculatorState,
  nextValue: number,
): CalculatorState {
  const normalizedValue = normalizeNumber(nextValue);

  if (normalizedValue === null) {
    return setErrorState(state);
  }

  return {
    ...state,
    displayValue: normalizedValue,
    errorState: false,
  };
}

function replaceWithDigit(
  state: CalculatorState,
  digit: string,
): CalculatorState {
  return {
    ...state,
    displayValue: digit,
    errorState: false,
    replaceDisplayOnNextDigit: false,
  };
}

function appendDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.errorState || state.replaceDisplayOnNextDigit) {
    return replaceWithDigit(state, digit);
  }

  if (state.displayValue === '0') {
    if (digit === '0') {
      return state;
    }

    return {
      ...state,
      displayValue: digit,
    };
  }

  return {
    ...state,
    displayValue: `${state.displayValue}${digit}`,
  };
}

function applyPendingOperator(
  state: CalculatorState,
  nextOperator: CalculatorBinaryOperator,
): CalculatorState {
  if (state.errorState) {
    return state;
  }

  const currentValue = parseDisplayValue(state.displayValue);

  if (
    state.pendingBinaryOperator &&
    state.storedValue !== null &&
    !state.replaceDisplayOnNextDigit
  ) {
    const result = applyBinaryOperator(
      state.storedValue,
      state.pendingBinaryOperator,
      currentValue,
    );

    if (result === null) {
      return setErrorState(state);
    }

    const updatedState = updateDisplayValue(state, result);

    if (updatedState.errorState) {
      return updatedState;
    }

    return {
      ...updatedState,
      pendingBinaryOperator: nextOperator,
      replaceDisplayOnNextDigit: true,
      storedValue: result,
    };
  }

  return {
    ...state,
    errorState: false,
    pendingBinaryOperator: nextOperator,
    replaceDisplayOnNextDigit: true,
    storedValue: currentValue,
  };
}

function applyEquals(state: CalculatorState): CalculatorState {
  if (state.errorState) {
    return state;
  }

  const currentValue = parseDisplayValue(state.displayValue);

  if (state.pendingBinaryOperator && state.storedValue !== null) {
    const rightOperand = currentValue;
    const result = applyBinaryOperator(
      state.storedValue,
      state.pendingBinaryOperator,
      rightOperand,
    );

    if (result === null) {
      return setErrorState(state);
    }

    const updatedState = updateDisplayValue(state, result);

    if (updatedState.errorState) {
      return updatedState;
    }

    return {
      ...updatedState,
      lastBinaryOperand: rightOperand,
      lastBinaryOperator: state.pendingBinaryOperator,
      pendingBinaryOperator: null,
      replaceDisplayOnNextDigit: true,
      storedValue: null,
    };
  }

  if (state.lastBinaryOperator && state.lastBinaryOperand !== null) {
    const result = applyBinaryOperator(
      currentValue,
      state.lastBinaryOperator,
      state.lastBinaryOperand,
    );

    if (result === null) {
      return setErrorState(state);
    }

    const updatedState = updateDisplayValue(state, result);

    if (updatedState.errorState) {
      return updatedState;
    }

    return {
      ...updatedState,
      replaceDisplayOnNextDigit: true,
    };
  }

  return state;
}

export function reduceCalculatorState(
  state: CalculatorState,
  actionId: CalculatorKeyActionId,
): CalculatorState {
  if (actionId.startsWith('digit:')) {
    return appendDigit(state, actionId.replace('digit:', ''));
  }

  switch (actionId) {
    case 'binary:add':
      return applyPendingOperator(state, 'add');
    case 'binary:divide':
      return applyPendingOperator(state, 'divide');
    case 'binary:multiply':
      return applyPendingOperator(state, 'multiply');
    case 'binary:subtract':
      return applyPendingOperator(state, 'subtract');
    case 'command:all-clear':
      return {
        ...initialCalculatorState,
      };
    case 'command:decimal':
      if (state.errorState || state.replaceDisplayOnNextDigit) {
        return {
          ...state,
          displayValue: '0.',
          errorState: false,
          replaceDisplayOnNextDigit: false,
        };
      }

      if (state.displayValue.includes('.')) {
        return state;
      }

      return {
        ...state,
        displayValue: `${state.displayValue}.`,
      };
    case 'command:equals':
      return applyEquals(state);
    case 'command:percent': {
      if (state.errorState) {
        return state;
      }

      const currentValue = parseDisplayValue(state.displayValue);
      const percentValue =
        state.pendingBinaryOperator && state.storedValue !== null
          ? (state.storedValue * currentValue) / 100
          : currentValue / 100;

      return updateDisplayValue(state, percentValue);
    }
    case 'command:toggle-sign':
      if (state.errorState || state.displayValue === '0') {
        return state;
      }

      return {
        ...state,
        displayValue: state.displayValue.startsWith('-')
          ? state.displayValue.slice(1)
          : `-${state.displayValue}`,
      };
    case 'mode:angle-deg':
      return {
        ...state,
        angleMode: 'deg',
      };
    case 'mode:angle-rad':
      return {
        ...state,
        angleMode: 'rad',
      };
    case 'mode:toggle-second':
      return {
        ...state,
        secondMode: !state.secondMode,
      };
    default:
      return state;
  }
}

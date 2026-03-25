import type { CalculatorKeyActionId } from '../config';
import {
  evaluateScientificBinaryOperation,
  evaluateScientificUnaryOperation,
} from '../lib';
import {
  type CalculatorBinaryOperator,
  type CalculatorParenthesisFrame,
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
    errorKind: 'domain',
    errorMessage: 'Error',
    lastBinaryOperand: null,
    lastBinaryOperator: null,
    pendingBinaryOperator: null,
    parenthesisStack: [],
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
  return evaluateScientificBinaryOperation(leftValue, operator, rightValue);
}

function applyResolvedDisplayValue(
  state: CalculatorState,
  displayValue: string,
  replaceDisplayOnNextDigit = true,
) {
  return {
    ...state,
    displayValue,
    errorState: false,
    errorKind: null,
    errorMessage: null,
    lastBinaryOperand: null,
    lastBinaryOperator: null,
    replaceDisplayOnNextDigit,
  };
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
    errorKind: null,
    errorMessage: null,
  };
}

function updateMemoryValue(
  state: CalculatorState,
  nextValue: number,
): CalculatorState {
  if (!Number.isFinite(nextValue)) {
    return setErrorState(state);
  }

  return {
    ...state,
    memoryValue: nextValue,
  };
}

function normalizeAndReplaceDisplay(
  state: CalculatorState,
  nextValue: number,
  replaceDisplayOnNextDigit = true,
) {
  const normalizedValue = normalizeNumber(nextValue);

  if (normalizedValue === null) {
    return setErrorState(state);
  }

  return applyResolvedDisplayValue(
    state,
    normalizedValue,
    replaceDisplayOnNextDigit,
  );
}

function applyScientificUnaryOperation(
  state: CalculatorState,
  operation:
    | 'arccos'
    | 'arccosh'
    | 'arcsin'
    | 'arcsinh'
    | 'arctan'
    | 'arctanh'
    | 'cos'
    | 'cosh'
    | 'cube'
    | 'cube-root'
    | 'exp-10'
    | 'exp-2'
    | 'exp-e'
    | 'factorial'
    | 'ln'
    | 'log-10'
    | 'log-2'
    | 'reciprocal'
    | 'sin'
    | 'sinh'
    | 'square'
    | 'square-root'
    | 'tan'
    | 'tanh',
) {
  if (state.errorState) {
    return state;
  }

  const currentValue = parseDisplayValue(state.displayValue);
  const result = evaluateScientificUnaryOperation(
    currentValue,
    operation,
    state.angleMode,
  );

  if (result === null) {
    return setErrorState(state);
  }

  return normalizeAndReplaceDisplay(state, result, true);
}

function applyScientificConstant(
  state: CalculatorState,
  constant: 'e' | 'pi' | 'rand',
) {
  if (state.errorState) {
    return state;
  }

  let nextValue: number;

  switch (constant) {
    case 'e':
      nextValue = Math.E;
      break;
    case 'pi':
      nextValue = Math.PI;
      break;
    case 'rand':
      nextValue = Math.random();
      break;
  }

  return normalizeAndReplaceDisplay(state, nextValue, true);
}

function applyScientificNotation(state: CalculatorState) {
  if (state.errorState || state.displayValue.includes('e')) {
    return state;
  }

  const nextDisplayValue = state.replaceDisplayOnNextDigit
    ? '0e'
    : `${state.displayValue}e`;

  return applyResolvedDisplayValue(state, nextDisplayValue, false);
}

function createParenthesisFrame(
  state: CalculatorState,
): CalculatorParenthesisFrame {
  return {
    lastBinaryOperand: state.lastBinaryOperand,
    lastBinaryOperator: state.lastBinaryOperator,
    pendingBinaryOperator: state.pendingBinaryOperator,
    replaceDisplayOnNextDigit: state.replaceDisplayOnNextDigit,
    storedValue: state.storedValue,
  };
}

function resetExpressionForParenthesis(state: CalculatorState) {
  return {
    ...state,
    displayValue: '0',
    errorState: false,
    errorKind: null,
    errorMessage: null,
    lastBinaryOperand: null,
    lastBinaryOperator: null,
    pendingBinaryOperator: null,
    replaceDisplayOnNextDigit: false,
    storedValue: null,
  };
}

function applyOpenParenthesis(state: CalculatorState): CalculatorState {
  if (state.errorState) {
    return state;
  }

  const canStartNestedExpression =
    state.displayValue === '0' ||
    state.pendingBinaryOperator !== null ||
    state.parenthesisStack.length > 0;

  if (!canStartNestedExpression) {
    return state;
  }

  return {
    ...resetExpressionForParenthesis(state),
    parenthesisStack: [
      ...state.parenthesisStack,
      createParenthesisFrame(state),
    ],
  };
}

function applyCloseParenthesis(state: CalculatorState): CalculatorState {
  if (state.errorState || state.parenthesisStack.length === 0) {
    return state;
  }

  const resolvedState =
    state.pendingBinaryOperator && state.storedValue !== null
      ? applyEquals(state)
      : state;

  if (resolvedState.errorState) {
    return resolvedState;
  }

  const nextStack = resolvedState.parenthesisStack.slice(0, -1);
  const previousFrame = resolvedState.parenthesisStack.at(-1);

  if (previousFrame === undefined) {
    return resolvedState;
  }

  return {
    ...resolvedState,
    lastBinaryOperand: previousFrame.lastBinaryOperand,
    lastBinaryOperator: previousFrame.lastBinaryOperator,
    parenthesisStack: nextStack,
    pendingBinaryOperator: previousFrame.pendingBinaryOperator,
    replaceDisplayOnNextDigit: true,
    storedValue: previousFrame.storedValue,
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
    errorKind: null,
    errorMessage: null,
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

function canBackspaceCurrentDisplay(state: CalculatorState) {
  return !(
    state.replaceDisplayOnNextDigit &&
    state.pendingBinaryOperator === null &&
    state.lastBinaryOperator !== null
  );
}

function applyBackspace(state: CalculatorState): CalculatorState {
  if (state.errorState || !canBackspaceCurrentDisplay(state)) {
    return state;
  }

  if (state.displayValue === '0') {
    return state;
  }

  const nextDisplayValue = state.displayValue.slice(0, -1);

  if (
    nextDisplayValue === '' ||
    nextDisplayValue === '-' ||
    nextDisplayValue === '+'
  ) {
    return {
      ...state,
      displayValue: '0',
      replaceDisplayOnNextDigit: false,
    };
  }

  return {
    ...state,
    displayValue: nextDisplayValue,
    replaceDisplayOnNextDigit: false,
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

function applyMemoryOperation(
  state: CalculatorState,
  operation: 'add' | 'clear' | 'recall' | 'subtract',
): CalculatorState {
  if (state.errorState) {
    return state;
  }

  const currentValue = parseDisplayValue(state.displayValue);

  switch (operation) {
    case 'add':
      return updateMemoryValue(state, state.memoryValue + currentValue);
    case 'clear':
      return {
        ...state,
        memoryValue: 0,
      };
    case 'recall':
      return applyResolvedDisplayValue(
        state,
        normalizeNumber(state.memoryValue) ?? '0',
        true,
      );
    case 'subtract':
      return updateMemoryValue(state, state.memoryValue - currentValue);
  }
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
    case 'binary:log-base':
      return applyPendingOperator(state, 'log-base');
    case 'binary:multiply':
      return applyPendingOperator(state, 'multiply');
    case 'binary:power':
      return applyPendingOperator(state, 'power');
    case 'binary:root':
      return applyPendingOperator(state, 'root');
    case 'binary:subtract':
      return applyPendingOperator(state, 'subtract');
    case 'binary:y-to-x':
      return applyPendingOperator(state, 'y-to-x');
    case 'group:open-parenthesis':
      return applyOpenParenthesis(state);
    case 'group:close-parenthesis':
      return applyCloseParenthesis(state);
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
          errorKind: null,
          errorMessage: null,
          replaceDisplayOnNextDigit: false,
        };
      }

      if (
        state.displayValue.includes('.') ||
        state.displayValue.includes('e')
      ) {
        return state;
      }

      return {
        ...state,
        displayValue: `${state.displayValue}.`,
      };
    case 'command:backspace':
      return applyBackspace(state);
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

      return normalizeAndReplaceDisplay(state, percentValue, true);
    }
    case 'memory:add':
      return applyMemoryOperation(state, 'add');
    case 'memory:clear':
      return applyMemoryOperation(state, 'clear');
    case 'memory:recall':
      return applyMemoryOperation(state, 'recall');
    case 'memory:subtract':
      return applyMemoryOperation(state, 'subtract');
    case 'command:toggle-sign':
      if (state.errorState || state.displayValue === '0') {
        return state;
      }

      return applyResolvedDisplayValue(
        state,
        state.displayValue.startsWith('-')
          ? state.displayValue.slice(1)
          : `-${state.displayValue}`,
        true,
      );
    case 'command:scientific-notation':
      return applyScientificNotation(state);
    case 'constant:e':
      return applyScientificConstant(state, 'e');
    case 'constant:pi':
      return applyScientificConstant(state, 'pi');
    case 'constant:rand':
      return applyScientificConstant(state, 'rand');
    case 'unary:arccos':
      return applyScientificUnaryOperation(state, 'arccos');
    case 'unary:arccosh':
      return applyScientificUnaryOperation(state, 'arccosh');
    case 'unary:arcsin':
      return applyScientificUnaryOperation(state, 'arcsin');
    case 'unary:arcsinh':
      return applyScientificUnaryOperation(state, 'arcsinh');
    case 'unary:arctan':
      return applyScientificUnaryOperation(state, 'arctan');
    case 'unary:arctanh':
      return applyScientificUnaryOperation(state, 'arctanh');
    case 'unary:cos':
      return applyScientificUnaryOperation(state, 'cos');
    case 'unary:cosh':
      return applyScientificUnaryOperation(state, 'cosh');
    case 'unary:cube':
      return applyScientificUnaryOperation(state, 'cube');
    case 'unary:cube-root':
      return applyScientificUnaryOperation(state, 'cube-root');
    case 'unary:exp-10':
      return applyScientificUnaryOperation(state, 'exp-10');
    case 'unary:exp-2':
      return applyScientificUnaryOperation(state, 'exp-2');
    case 'unary:exp-e':
      return applyScientificUnaryOperation(state, 'exp-e');
    case 'unary:factorial':
      return applyScientificUnaryOperation(state, 'factorial');
    case 'unary:ln':
      return applyScientificUnaryOperation(state, 'ln');
    case 'unary:log-10':
      return applyScientificUnaryOperation(state, 'log-10');
    case 'unary:log-2':
      return applyScientificUnaryOperation(state, 'log-2');
    case 'unary:reciprocal':
      return applyScientificUnaryOperation(state, 'reciprocal');
    case 'unary:sin':
      return applyScientificUnaryOperation(state, 'sin');
    case 'unary:sinh':
      return applyScientificUnaryOperation(state, 'sinh');
    case 'unary:square':
      return applyScientificUnaryOperation(state, 'square');
    case 'unary:square-root':
      return applyScientificUnaryOperation(state, 'square-root');
    case 'unary:tan':
      return applyScientificUnaryOperation(state, 'tan');
    case 'unary:tanh':
      return applyScientificUnaryOperation(state, 'tanh');
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

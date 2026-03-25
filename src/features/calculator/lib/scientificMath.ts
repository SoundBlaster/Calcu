import type {
  CalculatorAngleMode,
  CalculatorBinaryOperator,
  CalculatorUnaryAction,
} from '../model/calculatorTypes';

function toRadians(value: number, angleMode: CalculatorAngleMode) {
  return angleMode === 'deg' ? (value * Math.PI) / 180 : value;
}

function fromRadians(value: number, angleMode: CalculatorAngleMode) {
  return angleMode === 'deg' ? (value * 180) / Math.PI : value;
}

function safeFactorial(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  let result = 1;

  for (let index = 2; index <= value; index += 1) {
    result *= index;

    if (!Number.isFinite(result)) {
      return null;
    }
  }

  return result;
}

function safeRoot(base: number, degree: number) {
  if (degree === 0) {
    return null;
  }

  if (base < 0) {
    if (!Number.isInteger(degree) || Math.abs(degree) % 2 === 0) {
      return null;
    }

    const magnitude = Math.abs(base) ** (1 / degree);
    return Number.isFinite(magnitude) ? -magnitude : null;
  }

  const result = base ** (1 / degree);
  return Number.isFinite(result) ? result : null;
}

function safeLogBase(value: number, base: number) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(base) ||
    value <= 0 ||
    base <= 0 ||
    base === 1
  ) {
    return null;
  }

  const result = Math.log(value) / Math.log(base);
  return Number.isFinite(result) ? result : null;
}

function safeTan(value: number) {
  const cosine = Math.cos(value);

  if (Math.abs(cosine) < 1e-12) {
    return null;
  }

  const result = Math.tan(value);
  return Number.isFinite(result) ? result : null;
}

export function evaluateScientificUnaryOperation(
  value: number,
  operation: CalculatorUnaryAction,
  angleMode: CalculatorAngleMode,
) {
  switch (operation) {
    case 'arccos': {
      const result = Math.acos(value);
      return Number.isFinite(result) ? fromRadians(result, angleMode) : null;
    }
    case 'arccosh':
      return Number.isFinite(Math.acosh(value)) ? Math.acosh(value) : null;
    case 'arcsin': {
      const result = Math.asin(value);
      return Number.isFinite(result) ? fromRadians(result, angleMode) : null;
    }
    case 'arcsinh':
      return Number.isFinite(Math.asinh(value)) ? Math.asinh(value) : null;
    case 'arctan': {
      const result = Math.atan(value);
      return Number.isFinite(result) ? fromRadians(result, angleMode) : null;
    }
    case 'arctanh':
      return Number.isFinite(Math.atanh(value)) ? Math.atanh(value) : null;
    case 'cos':
      return Number.isFinite(Math.cos(toRadians(value, angleMode)))
        ? Math.cos(toRadians(value, angleMode))
        : null;
    case 'cosh':
      return Number.isFinite(Math.cosh(value)) ? Math.cosh(value) : null;
    case 'cube':
      return value ** 3;
    case 'cube-root':
      return Math.cbrt(value);
    case 'exp-10':
      return 10 ** value;
    case 'exp-2':
      return 2 ** value;
    case 'exp-e':
      return Math.exp(value);
    case 'factorial':
      return safeFactorial(value);
    case 'ln':
      return value > 0 ? Math.log(value) : null;
    case 'log-10':
      return value > 0 ? Math.log10(value) : null;
    case 'log-2':
      return value > 0 ? Math.log2(value) : null;
    case 'reciprocal':
      return value === 0 ? null : 1 / value;
    case 'sin':
      return Number.isFinite(Math.sin(toRadians(value, angleMode)))
        ? Math.sin(toRadians(value, angleMode))
        : null;
    case 'sinh':
      return Number.isFinite(Math.sinh(value)) ? Math.sinh(value) : null;
    case 'square':
      return value ** 2;
    case 'square-root':
      return value < 0 ? null : Math.sqrt(value);
    case 'tan':
      return safeTan(toRadians(value, angleMode));
    case 'tanh':
      return Number.isFinite(Math.tanh(value)) ? Math.tanh(value) : null;
  }
}

export function evaluateScientificBinaryOperation(
  leftValue: number,
  operator: CalculatorBinaryOperator,
  rightValue: number,
) {
  switch (operator) {
    case 'add':
      return leftValue + rightValue;
    case 'divide':
      return rightValue === 0 ? null : leftValue / rightValue;
    case 'log-base':
      return safeLogBase(leftValue, rightValue);
    case 'multiply':
      return leftValue * rightValue;
    case 'power':
    case 'y-to-x':
      return leftValue ** rightValue;
    case 'root':
      return safeRoot(leftValue, rightValue);
    case 'subtract':
      return leftValue - rightValue;
  }
}

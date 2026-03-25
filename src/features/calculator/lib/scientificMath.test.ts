import { describe, expect, it } from 'vitest';
import {
  evaluateScientificBinaryOperation,
  evaluateScientificUnaryOperation,
} from './scientificMath';

describe('scientificMath', () => {
  it('evaluates unary scientific operations across common calculator modes', () => {
    expect(evaluateScientificUnaryOperation(90, 'sin', 'deg')).toBeCloseTo(1);
    expect(evaluateScientificUnaryOperation(0, 'arcsin', 'deg')).toBe(0);
    expect(evaluateScientificUnaryOperation(1, 'arccos', 'deg')).toBe(0);
    expect(evaluateScientificUnaryOperation(1, 'arctan', 'deg')).toBe(45);
    expect(evaluateScientificUnaryOperation(0, 'arcsinh', 'rad')).toBe(0);
    expect(evaluateScientificUnaryOperation(1, 'arccosh', 'rad')).toBe(0);
    expect(evaluateScientificUnaryOperation(0, 'arctanh', 'rad')).toBe(0);
    expect(evaluateScientificUnaryOperation(2, 'cube', 'rad')).toBe(8);
    expect(evaluateScientificUnaryOperation(8, 'cube-root', 'rad')).toBe(2);
    expect(evaluateScientificUnaryOperation(3, 'exp-2', 'rad')).toBe(8);
    expect(evaluateScientificUnaryOperation(2, 'exp-10', 'rad')).toBe(100);
    expect(evaluateScientificUnaryOperation(1, 'exp-e', 'rad')).toBeCloseTo(
      Math.E,
    );
    expect(evaluateScientificUnaryOperation(5, 'factorial', 'rad')).toBe(120);
    expect(evaluateScientificUnaryOperation(8, 'ln', 'rad')).toBeCloseTo(
      Math.log(8),
    );
    expect(evaluateScientificUnaryOperation(100, 'log-10', 'rad')).toBe(2);
    expect(evaluateScientificUnaryOperation(8, 'log-2', 'rad')).toBe(3);
    expect(evaluateScientificUnaryOperation(4, 'reciprocal', 'rad')).toBe(0.25);
    expect(evaluateScientificUnaryOperation(16, 'square', 'rad')).toBe(256);
    expect(evaluateScientificUnaryOperation(16, 'square-root', 'rad')).toBe(4);
    expect(evaluateScientificUnaryOperation(0, 'cos', 'deg')).toBe(1);
    expect(evaluateScientificUnaryOperation(1, 'tan', 'rad')).toBeCloseTo(
      Math.tan(1),
    );
    expect(evaluateScientificUnaryOperation(1, 'sinh', 'rad')).toBeCloseTo(
      Math.sinh(1),
    );
    expect(evaluateScientificUnaryOperation(1, 'tanh', 'rad')).toBeCloseTo(
      Math.tanh(1),
    );
  });

  it('returns null for invalid unary inputs', () => {
    expect(evaluateScientificUnaryOperation(-1, 'factorial', 'rad')).toBeNull();
    expect(
      evaluateScientificUnaryOperation(3.5, 'factorial', 'rad'),
    ).toBeNull();
    expect(
      evaluateScientificUnaryOperation(-1, 'square-root', 'rad'),
    ).toBeNull();
    expect(evaluateScientificUnaryOperation(0, 'reciprocal', 'rad')).toBeNull();
    expect(evaluateScientificUnaryOperation(0, 'ln', 'rad')).toBeNull();
    expect(evaluateScientificUnaryOperation(0, 'log-10', 'rad')).toBeNull();
    expect(evaluateScientificUnaryOperation(0, 'log-2', 'rad')).toBeNull();
    expect(evaluateScientificUnaryOperation(90, 'tan', 'deg')).toBeNull();
    expect(evaluateScientificUnaryOperation(2, 'arccos', 'rad')).toBeNull();
    expect(evaluateScientificUnaryOperation(1, 'arctanh', 'rad')).toBeNull();
  });

  it('evaluates binary scientific operations and rejects invalid cases', () => {
    expect(evaluateScientificBinaryOperation(2, 'add', 3)).toBe(5);
    expect(evaluateScientificBinaryOperation(5, 'subtract', 3)).toBe(2);
    expect(evaluateScientificBinaryOperation(4, 'multiply', 3)).toBe(12);
    expect(evaluateScientificBinaryOperation(12, 'divide', 3)).toBe(4);
    expect(evaluateScientificBinaryOperation(2, 'power', 3)).toBe(8);
    expect(evaluateScientificBinaryOperation(2, 'y-to-x', 3)).toBe(8);
    expect(evaluateScientificBinaryOperation(16, 'root', 2)).toBe(4);
    expect(evaluateScientificBinaryOperation(-8, 'root', 3)).toBe(-2);
    expect(evaluateScientificBinaryOperation(16, 'log-base', 2)).toBe(4);
    expect(evaluateScientificBinaryOperation(8, 'log-base', 2)).toBe(3);
    expect(evaluateScientificBinaryOperation(1, 'log-base', 10)).toBe(0);

    expect(evaluateScientificBinaryOperation(1, 'divide', 0)).toBeNull();
    expect(evaluateScientificBinaryOperation(-16, 'root', 2)).toBeNull();
    expect(evaluateScientificBinaryOperation(16, 'root', 0)).toBeNull();
    expect(evaluateScientificBinaryOperation(10, 'log-base', 1)).toBeNull();
    expect(evaluateScientificBinaryOperation(10, 'log-base', 0)).toBeNull();
  });
});

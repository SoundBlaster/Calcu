import { evaluateScientificBinaryOperation } from '../src/features/calculator/lib/scientificMath';

export type Calculation = {
  operator: 'add' | 'subtract' | 'multiply' | 'divide';
  left: number;
  right: number;
};

export type CalculationResult = Calculation & { result: number };

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('schema_invalid');
  return value as Record<string, unknown>;
}

export function exact(value: unknown, keys: string[]) {
  const record = object(value);
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(','))
    throw new Error('schema_invalid');
  return record;
}

export function validateCalculation(value: unknown): Calculation {
  const input = exact(value, ['operator', 'left', 'right']);
  if (
    !['add', 'subtract', 'multiply', 'divide'].includes(
      String(input.operator),
    ) ||
    typeof input.left !== 'number' ||
    typeof input.right !== 'number' ||
    !Number.isFinite(input.left) ||
    !Number.isFinite(input.right)
  )
    throw new Error('schema_invalid');
  return input as Calculation;
}

export function calculate(input: Calculation): CalculationResult {
  const result = evaluateScientificBinaryOperation(
    input.left,
    input.operator,
    input.right,
  );
  if (typeof result !== 'number' || !Number.isFinite(result))
    throw new Error('invalid_result');
  return { ...input, result };
}

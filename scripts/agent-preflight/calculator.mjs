import { evaluateScientificBinaryOperation } from './math.mjs';

export const tool = {
  name: 'calculation_propose',
  description:
    'Return a non-persisted calculation suggestion using Calcu. No state changes.',
  inputSchema: {
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
      },
      left: { type: 'number' },
      right: { type: 'number' },
    },
    required: ['operator', 'left', 'right'],
    additionalProperties: false,
  },
};

export function calculate(input) {
  if (
    !input ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(',') !== 'left,operator,right' ||
    !tool.inputSchema.properties.operator.enum.includes(input.operator) ||
    !Number.isFinite(input.left) ||
    !Number.isFinite(input.right)
  ) {
    throw new Error('invalid_input');
  }
  const result = evaluateScientificBinaryOperation(
    input.left,
    input.operator,
    input.right,
  );
  if (!Number.isFinite(result)) throw new Error('invalid_result');
  return { ...input, result };
}

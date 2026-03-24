import { layoutTokens } from './layoutTokens';

type CalculatorDigit =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9';
type CalculatorBinaryAction =
  | 'add'
  | 'divide'
  | 'log-base'
  | 'multiply'
  | 'power'
  | 'root'
  | 'subtract'
  | 'y-to-x';
type CalculatorCommandAction =
  | 'all-clear'
  | 'decimal'
  | 'equals'
  | 'backspace'
  | 'percent'
  | 'scientific-notation'
  | 'toggle-sign';
type CalculatorConstantAction = 'e' | 'pi' | 'rand';
type CalculatorGroupAction = 'close-parenthesis' | 'open-parenthesis';
type CalculatorMemoryAction = 'add' | 'clear' | 'recall' | 'subtract';
type CalculatorModeAction = 'angle-deg' | 'angle-rad' | 'toggle-second';
type CalculatorUnaryAction =
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
  | 'tanh';

export type CalculatorKeyActionId =
  | `binary:${CalculatorBinaryAction}`
  | `command:${CalculatorCommandAction}`
  | `constant:${CalculatorConstantAction}`
  | `digit:${CalculatorDigit}`
  | `group:${CalculatorGroupAction}`
  | `memory:${CalculatorMemoryAction}`
  | `mode:${CalculatorModeAction}`
  | `unary:${CalculatorUnaryAction}`;

export type CalculatorKeyVariant = 'input' | 'operator' | 'system';

export type CalculatorKeyDefinition = Readonly<{
  actionId: CalculatorKeyActionId;
  columnSpan?: number;
  label: string;
  variant: CalculatorKeyVariant;
}>;

export type CalculatorKeyRow = ReadonlyArray<CalculatorKeyDefinition>;

function defineKey(
  label: string,
  actionId: CalculatorKeyActionId,
  {
    columnSpan,
    variant = 'input',
  }: Readonly<{
    columnSpan?: number;
    variant?: CalculatorKeyVariant;
  }> = {},
): CalculatorKeyDefinition {
  return {
    actionId,
    columnSpan,
    label,
    variant,
  };
}

export function isWideCalculatorKey(key: CalculatorKeyDefinition) {
  return (key.columnSpan ?? 1) > 1;
}

export const portraitKeyRows = [
  [
    defineKey('AC', 'command:all-clear', { variant: 'system' }),
    defineKey('+/-', 'command:toggle-sign', { variant: 'system' }),
    defineKey('%', 'command:percent', { variant: 'system' }),
    defineKey('÷', 'binary:divide', { variant: 'operator' }),
  ],
  [
    defineKey('7', 'digit:7'),
    defineKey('8', 'digit:8'),
    defineKey('9', 'digit:9'),
    defineKey('×', 'binary:multiply', { variant: 'operator' }),
  ],
  [
    defineKey('4', 'digit:4'),
    defineKey('5', 'digit:5'),
    defineKey('6', 'digit:6'),
    defineKey('-', 'binary:subtract', { variant: 'operator' }),
  ],
  [
    defineKey('1', 'digit:1'),
    defineKey('2', 'digit:2'),
    defineKey('3', 'digit:3'),
    defineKey('+', 'binary:add', { variant: 'operator' }),
  ],
  [
    defineKey('0', 'digit:0', {
      columnSpan: layoutTokens.button.zeroColumnSpan,
    }),
    defineKey(',', 'command:decimal'),
    defineKey('=', 'command:equals', { variant: 'operator' }),
  ],
] as const satisfies ReadonlyArray<CalculatorKeyRow>;

export const landscapeScientificKeyRows = [
  [
    defineKey('(', 'group:open-parenthesis'),
    defineKey(')', 'group:close-parenthesis'),
    defineKey('mc', 'memory:clear'),
    defineKey('m+', 'memory:add'),
    defineKey('m-', 'memory:subtract'),
    defineKey('mr', 'memory:recall'),
    defineKey('AC', 'command:all-clear', { variant: 'system' }),
    defineKey('+/-', 'command:toggle-sign', { variant: 'system' }),
    defineKey('%', 'command:percent', { variant: 'system' }),
    defineKey('÷', 'binary:divide', { variant: 'operator' }),
  ],
  [
    defineKey('2nd', 'mode:toggle-second'),
    defineKey('x²', 'unary:square'),
    defineKey('x³', 'unary:cube'),
    defineKey('xʸ', 'binary:power'),
    defineKey('eˣ', 'unary:exp-e'),
    defineKey('10ˣ', 'unary:exp-10'),
    defineKey('7', 'digit:7'),
    defineKey('8', 'digit:8'),
    defineKey('9', 'digit:9'),
    defineKey('×', 'binary:multiply', { variant: 'operator' }),
  ],
  [
    defineKey('¹/x', 'unary:reciprocal'),
    defineKey('²√x', 'unary:square-root'),
    defineKey('³√x', 'unary:cube-root'),
    defineKey('ʸ√x', 'binary:root'),
    defineKey('ln', 'unary:ln'),
    defineKey('log₁₀', 'unary:log-10'),
    defineKey('4', 'digit:4'),
    defineKey('5', 'digit:5'),
    defineKey('6', 'digit:6'),
    defineKey('-', 'binary:subtract', { variant: 'operator' }),
  ],
  [
    defineKey('x!', 'unary:factorial'),
    defineKey('sin', 'unary:sin'),
    defineKey('cos', 'unary:cos'),
    defineKey('tan', 'unary:tan'),
    defineKey('e', 'constant:e'),
    defineKey('EE', 'command:scientific-notation'),
    defineKey('1', 'digit:1'),
    defineKey('2', 'digit:2'),
    defineKey('3', 'digit:3'),
    defineKey('+', 'binary:add', { variant: 'operator' }),
  ],
  [
    defineKey('Rad', 'mode:angle-rad'),
    defineKey('sinh', 'unary:sinh'),
    defineKey('cosh', 'unary:cosh'),
    defineKey('tanh', 'unary:tanh'),
    defineKey('π', 'constant:pi'),
    defineKey('Rand', 'constant:rand'),
    defineKey('0', 'digit:0', {
      columnSpan: layoutTokens.button.zeroColumnSpan,
    }),
    defineKey(',', 'command:decimal'),
    defineKey('=', 'command:equals', { variant: 'operator' }),
  ],
] as const satisfies ReadonlyArray<CalculatorKeyRow>;

export const landscapeScientificSecondKeyRows = [
  [
    defineKey('(', 'group:open-parenthesis'),
    defineKey(')', 'group:close-parenthesis'),
    defineKey('mc', 'memory:clear'),
    defineKey('m+', 'memory:add'),
    defineKey('m-', 'memory:subtract'),
    defineKey('mr', 'memory:recall'),
    defineKey('AC', 'command:all-clear', { variant: 'system' }),
    defineKey('+/-', 'command:toggle-sign', { variant: 'system' }),
    defineKey('%', 'command:percent', { variant: 'system' }),
    defineKey('÷', 'binary:divide', { variant: 'operator' }),
  ],
  [
    defineKey('2nd', 'mode:toggle-second'),
    defineKey('x²', 'unary:square'),
    defineKey('x³', 'unary:cube'),
    defineKey('xʸ', 'binary:power'),
    defineKey('yˣ', 'binary:y-to-x'),
    defineKey('2ˣ', 'unary:exp-2'),
    defineKey('7', 'digit:7'),
    defineKey('8', 'digit:8'),
    defineKey('9', 'digit:9'),
    defineKey('×', 'binary:multiply', { variant: 'operator' }),
  ],
  [
    defineKey('¹/x', 'unary:reciprocal'),
    defineKey('²√x', 'unary:square-root'),
    defineKey('³√x', 'unary:cube-root'),
    defineKey('ʸ√x', 'binary:root'),
    defineKey('logᵧ', 'binary:log-base'),
    defineKey('log₂', 'unary:log-2'),
    defineKey('4', 'digit:4'),
    defineKey('5', 'digit:5'),
    defineKey('6', 'digit:6'),
    defineKey('-', 'binary:subtract', { variant: 'operator' }),
  ],
  [
    defineKey('x!', 'unary:factorial'),
    defineKey('sin⁻¹', 'unary:arcsin'),
    defineKey('cos⁻¹', 'unary:arccos'),
    defineKey('tan⁻¹', 'unary:arctan'),
    defineKey('e', 'constant:e'),
    defineKey('EE', 'command:scientific-notation'),
    defineKey('1', 'digit:1'),
    defineKey('2', 'digit:2'),
    defineKey('3', 'digit:3'),
    defineKey('+', 'binary:add', { variant: 'operator' }),
  ],
  [
    defineKey('Deg', 'mode:angle-deg'),
    defineKey('sinh⁻¹', 'unary:arcsinh'),
    defineKey('cosh⁻¹', 'unary:arccosh'),
    defineKey('tanh⁻¹', 'unary:arctanh'),
    defineKey('π', 'constant:pi'),
    defineKey('Rand', 'constant:rand'),
    defineKey('0', 'digit:0', {
      columnSpan: layoutTokens.button.zeroColumnSpan,
    }),
    defineKey(',', 'command:decimal'),
    defineKey('=', 'command:equals', { variant: 'operator' }),
  ],
] as const satisfies ReadonlyArray<CalculatorKeyRow>;

export function getLandscapeScientificKeyRows(secondMode: boolean) {
  return secondMode
    ? landscapeScientificSecondKeyRows
    : landscapeScientificKeyRows;
}

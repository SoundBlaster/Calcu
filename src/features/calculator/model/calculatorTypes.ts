export type CalculatorBinaryOperator =
  | 'add'
  | 'divide'
  | 'log-base'
  | 'multiply'
  | 'power'
  | 'root'
  | 'subtract'
  | 'y-to-x';

export type CalculatorParenthesisFrame = Readonly<{
  lastBinaryOperand: number | null;
  lastBinaryOperator: CalculatorBinaryOperator | null;
  pendingBinaryOperator: CalculatorBinaryOperator | null;
  replaceDisplayOnNextDigit: boolean;
  storedValue: number | null;
}>;

export type CalculatorAngleMode = 'deg' | 'rad';

export type CalculatorUnaryAction =
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

export type CalculatorBinaryAction = CalculatorBinaryOperator;

export type CalculatorCommandAction =
  | 'all-clear'
  | 'backspace'
  | 'decimal'
  | 'equals'
  | 'percent'
  | 'scientific-notation'
  | 'toggle-sign';

export type CalculatorConstantAction = 'e' | 'pi' | 'rand';

export type CalculatorGroupAction = 'close-parenthesis' | 'open-parenthesis';

export type CalculatorMemoryAction = 'add' | 'clear' | 'recall' | 'subtract';

export type CalculatorModeAction = 'angle-deg' | 'angle-rad' | 'toggle-second';

export type CalculatorAction =
  | Readonly<{ kind: 'binary'; operator: CalculatorBinaryAction }>
  | Readonly<{ kind: 'command'; command: CalculatorCommandAction }>
  | Readonly<{ kind: 'constant'; constant: CalculatorConstantAction }>
  | Readonly<{ kind: 'digit'; digit: string }>
  | Readonly<{ kind: 'group'; group: CalculatorGroupAction }>
  | Readonly<{ kind: 'memory'; memory: CalculatorMemoryAction }>
  | Readonly<{ kind: 'mode'; mode: CalculatorModeAction }>
  | Readonly<{ kind: 'unary'; unary: CalculatorUnaryAction }>;

export type CalculatorErrorKind = 'domain' | 'overflow' | 'parse';

export type CalculatorErrorState = Readonly<{
  kind: CalculatorErrorKind | null;
  message: string | null;
}>;

export type CalculatorState = Readonly<{
  angleMode: CalculatorAngleMode;
  displayValue: string;
  errorState: boolean;
  errorKind: CalculatorErrorKind | null;
  errorMessage: string | null;
  lastBinaryOperand: number | null;
  lastBinaryOperator: CalculatorBinaryOperator | null;
  memoryValue: number;
  parenthesisStack: ReadonlyArray<CalculatorParenthesisFrame>;
  pendingBinaryOperator: CalculatorBinaryOperator | null;
  replaceDisplayOnNextDigit: boolean;
  secondMode: boolean;
  storedValue: number | null;
}>;

export const initialCalculatorState: CalculatorState = {
  angleMode: 'rad',
  displayValue: '0',
  errorState: false,
  errorKind: null,
  errorMessage: null,
  lastBinaryOperand: null,
  lastBinaryOperator: null,
  memoryValue: 0,
  parenthesisStack: [],
  pendingBinaryOperator: null,
  replaceDisplayOnNextDigit: false,
  secondMode: false,
  storedValue: null,
};

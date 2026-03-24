export type CalculatorBinaryOperator =
  | 'add'
  | 'divide'
  | 'multiply'
  | 'subtract';

export type CalculatorAngleMode = 'deg' | 'rad';

export type CalculatorState = Readonly<{
  angleMode: CalculatorAngleMode;
  displayValue: string;
  errorState: boolean;
  lastBinaryOperand: number | null;
  lastBinaryOperator: CalculatorBinaryOperator | null;
  pendingBinaryOperator: CalculatorBinaryOperator | null;
  replaceDisplayOnNextDigit: boolean;
  secondMode: boolean;
  storedValue: number | null;
}>;

export const initialCalculatorState: CalculatorState = {
  angleMode: 'rad',
  displayValue: '0',
  errorState: false,
  lastBinaryOperand: null,
  lastBinaryOperator: null,
  pendingBinaryOperator: null,
  replaceDisplayOnNextDigit: false,
  secondMode: false,
  storedValue: null,
};

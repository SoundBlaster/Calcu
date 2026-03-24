import { describe, expect, it } from 'vitest';
import {
  getLandscapeScientificKeyRows,
  isWideCalculatorKey,
  landscapeScientificKeyRows,
  landscapeScientificSecondKeyRows,
  portraitKeyRows,
} from './keyDefinitions';

function getLabels(rows: ReadonlyArray<ReadonlyArray<{ label: string }>>) {
  return rows.map((row) => row.map((key) => key.label));
}

describe('keyDefinitions', () => {
  it('defines the portrait keypad rows exactly as the standard calculator layout', () => {
    expect(getLabels(portraitKeyRows)).toEqual([
      ['AC', '+/-', '%', '÷'],
      ['7', '8', '9', '×'],
      ['4', '5', '6', '-'],
      ['1', '2', '3', '+'],
      ['0', ',', '='],
    ]);
  });

  it('marks the portrait and landscape zero keys as double-width pills', () => {
    expect(isWideCalculatorKey(portraitKeyRows[4][0])).toBe(true);
    expect(isWideCalculatorKey(landscapeScientificKeyRows[4][6])).toBe(true);
    expect(isWideCalculatorKey(landscapeScientificSecondKeyRows[4][6])).toBe(
      true,
    );
  });

  it('defines the landscape scientific layout exactly for normal mode', () => {
    expect(getLabels(landscapeScientificKeyRows)).toEqual([
      ['(', ')', 'mc', 'm+', 'm-', 'mr', 'AC', '+/-', '%', '÷'],
      ['2nd', 'x²', 'x³', 'xʸ', 'eˣ', '10ˣ', '7', '8', '9', '×'],
      ['¹/x', '²√x', '³√x', 'ʸ√x', 'ln', 'log₁₀', '4', '5', '6', '-'],
      ['x!', 'sin', 'cos', 'tan', 'e', 'EE', '1', '2', '3', '+'],
      ['Rad', 'sinh', 'cosh', 'tanh', 'π', 'Rand', '0', ',', '='],
    ]);
  });

  it('defines the landscape scientific layout exactly for 2nd mode', () => {
    expect(getLabels(landscapeScientificSecondKeyRows)).toEqual([
      ['(', ')', 'mc', 'm+', 'm-', 'mr', 'AC', '+/-', '%', '÷'],
      ['2nd', 'x²', 'x³', 'xʸ', 'yˣ', '2ˣ', '7', '8', '9', '×'],
      ['¹/x', '²√x', '³√x', 'ʸ√x', 'logᵧ', 'log₂', '4', '5', '6', '-'],
      ['x!', 'sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'e', 'EE', '1', '2', '3', '+'],
      ['Deg', 'sinh⁻¹', 'cosh⁻¹', 'tanh⁻¹', 'π', 'Rand', '0', ',', '='],
    ]);
  });

  it('exposes stable variants and mode-specific access helpers', () => {
    expect(landscapeScientificKeyRows[0][6].variant).toBe('system');
    expect(landscapeScientificKeyRows[0][9].variant).toBe('operator');
    expect(landscapeScientificKeyRows[3][1].variant).toBe('input');
    expect(getLandscapeScientificKeyRows(false)).toBe(
      landscapeScientificKeyRows,
    );
    expect(getLandscapeScientificKeyRows(true)).toBe(
      landscapeScientificSecondKeyRows,
    );
  });
});

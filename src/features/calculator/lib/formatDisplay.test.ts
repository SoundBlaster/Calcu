import { describe, expect, it } from 'vitest';
import { formatDisplayValue } from './formatDisplay';

describe('formatDisplayValue', () => {
  it('preserves error tokens', () => {
    expect(formatDisplayValue('Error')).toBe('Error');
  });

  it('converts decimal separators for the UI', () => {
    expect(formatDisplayValue('1234.56')).toBe('1234,56');
  });

  it('condenses long numeric values safely', () => {
    const formattedValue = formatDisplayValue('12345678901234567890');

    expect(formattedValue.length).toBeLessThanOrEqual(12);
    expect(formattedValue).not.toBe('12345678901234567890');
  });
});

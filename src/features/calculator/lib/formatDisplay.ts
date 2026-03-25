const DEFAULT_MAX_DISPLAY_LENGTH = 12;

export function formatDisplayValue(
  value: string,
  maxLength = DEFAULT_MAX_DISPLAY_LENGTH,
) {
  if (value === 'Error') {
    return value;
  }

  const normalizedValue = value.replace('.', ',');

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return normalizedValue.slice(0, maxLength);
  }

  const scientificValue = parsedValue.toExponential(6).replace('.', ',');

  return scientificValue.length <= maxLength
    ? scientificValue
    : scientificValue.slice(0, maxLength);
}

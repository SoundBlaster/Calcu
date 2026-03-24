import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLandscapeScientificKeyRows } from '../config';
import { Keypad } from './Keypad';

describe('Keypad', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(element: ReactElement) {
    act(() => {
      root.render(element);
    });
  }

  function getButtonTexts() {
    return Array.from(container.querySelectorAll('button')).map(
      (button) => button.textContent,
    );
  }

  it('renders the portrait keypad rows from shared metadata', () => {
    render(<Keypad />);

    expect(getButtonTexts()).toEqual([
      'AC',
      '+/-',
      '%',
      '÷',
      '7',
      '8',
      '9',
      '×',
      '4',
      '5',
      '6',
      '-',
      '1',
      '2',
      '3',
      '+',
      '0',
      ',',
      '=',
    ]);
  });

  it('renders the landscape scientific rows in normal mode', () => {
    render(
      <Keypad layout="landscape" rows={getLandscapeScientificKeyRows(false)} />,
    );

    expect(getButtonTexts()).toContain('10ˣ');
    expect(getButtonTexts()).toContain('ln');
    expect(getButtonTexts()).toContain('Rand');
    expect(getButtonTexts()).not.toContain('2ˣ');
    expect(getButtonTexts()).not.toContain('logᵧ');
  });

  it('renders the landscape scientific rows in 2nd mode with an active toggle', () => {
    render(
      <Keypad
        activeActionIds={new Set(['mode:toggle-second'])}
        layout="landscape"
        rows={getLandscapeScientificKeyRows(true)}
      />,
    );

    const secondButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '2nd',
    );

    if (!secondButton) {
      throw new Error('Expected 2nd button to render.');
    }

    expect(secondButton.getAttribute('data-active')).toBe('true');
    expect(secondButton.getAttribute('data-variant')).toBe('system');
    expect(getButtonTexts()).toContain('yˣ');
    expect(getButtonTexts()).toContain('logᵧ');
    expect(getButtonTexts()).toContain('sin⁻¹');
    expect(getButtonTexts()).toContain('Deg');
  });

  it('preserves the wide zero key treatment inside the portrait grid', () => {
    render(<Keypad />);

    const zeroButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '0',
    );

    if (!zeroButton) {
      throw new Error('Expected zero button to render.');
    }

    expect(zeroButton.getAttribute('data-wide')).toBe('true');
  });

  it('forwards keypad button presses through the shared key metadata contract', () => {
    const onKeyPress = vi.fn();

    render(<Keypad onKeyPress={onKeyPress} />);

    const equalsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '=',
    );

    if (!equalsButton) {
      throw new Error('Expected equals button to render.');
    }

    equalsButton.click();

    expect(onKeyPress).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'command:equals',
        label: '=',
        variant: 'operator',
      }),
    );
  });
});

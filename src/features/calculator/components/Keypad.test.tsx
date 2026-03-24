import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders the portrait keypad rows from shared metadata', () => {
    render(<Keypad />);

    const buttons = Array.from(container.querySelectorAll('button')).map(
      (button) => button.textContent,
    );

    expect(buttons).toEqual([
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

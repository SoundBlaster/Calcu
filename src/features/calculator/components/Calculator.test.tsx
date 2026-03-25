import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Calculator } from './Calculator';

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
    writable: true,
  });
}

describe('Calculator', () => {
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

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );

    if (!button) {
      throw new Error(`Expected button "${label}" to render.`);
    }

    act(() => {
      button.click();
    });
  }

  function getDisplayValue() {
    const output = container.querySelector('output');

    if (!output) {
      throw new Error('Expected display to render.');
    }

    return output.textContent;
  }

  it('resolves standard button input through the reducer-backed feature', () => {
    setViewportSize(430, 932);
    render(<Calculator />);

    clickButton('1');
    clickButton('+');
    clickButton('2');
    clickButton('=');

    expect(getDisplayValue()).toBe('3');
  });

  it('preserves display value and second mode across viewport changes', () => {
    setViewportSize(1280, 720);
    render(<Calculator />);

    clickButton('2nd');
    clickButton('9');

    expect(getDisplayValue()).toBe('9');
    expect(container.textContent).toContain('yˣ');

    act(() => {
      setViewportSize(430, 932);
      window.dispatchEvent(new Event('resize'));
    });

    expect(getDisplayValue()).toBe('9');

    act(() => {
      setViewportSize(1280, 720);
      window.dispatchEvent(new Event('resize'));
    });

    expect(getDisplayValue()).toBe('9');
    expect(container.textContent).toContain('yˣ');
  });

  it('routes keyboard input through the reducer-backed calculator flow', () => {
    setViewportSize(430, 932);
    render(<Calculator />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('3');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('0');
  });

  it('ignores Enter on a focused calculator button so native click handling is not duplicated', () => {
    setViewportSize(430, 932);
    render(<Calculator />);

    clickButton('1');
    clickButton('+');
    clickButton('2');

    const equalsButton = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === '=',
    );

    if (!equalsButton) {
      throw new Error('Expected equals button to render.');
    }

    act(() => {
      equalsButton.click();
    });

    expect(getDisplayValue()).toBe('3');

    act(() => {
      equalsButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('3');
  });

  it('deletes active digits with backspace and ignores it after equals', () => {
    setViewportSize(430, 932);
    render(<Calculator />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('1');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('0');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '=', bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
      );
    });

    expect(getDisplayValue()).toBe('3');
  });
});

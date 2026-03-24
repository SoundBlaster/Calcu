import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Display } from './Display';

describe('Display', () => {
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

  function getOutput() {
    const output = container.querySelector('output');

    if (!output) {
      throw new Error('Expected display output to render.');
    }

    return output;
  }

  it('renders the calculator value in a live output region', () => {
    render(<Display value="0" />);

    const output = getOutput();

    expect(output.textContent).toBe('0');
    expect(output.getAttribute('aria-live')).toBe('polite');
    expect(output.getAttribute('data-scale')).toBe('default');
  });

  it('marks longer values for compact scale-down', () => {
    render(<Display value="1234567890123" />);

    expect(getOutput().getAttribute('data-scale')).toBe('compact');
  });

  it('marks very long values for compressed scale-down', () => {
    render(<Display value="1234567890123456789" />);

    expect(getOutput().getAttribute('data-scale')).toBe('compressed');
  });
});

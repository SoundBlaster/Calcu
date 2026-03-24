import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalcButton } from './CalcButton';

describe('CalcButton', () => {
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

  function getButton() {
    const button = container.querySelector('button');

    if (!button) {
      throw new Error('Expected calculator button to render.');
    }

    return button;
  }

  it('renders a semantic button with the provided label', () => {
    render(<CalcButton label="AC" variant="system" />);

    const button = getButton();

    expect(button.textContent).toBe('AC');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-variant')).toBe('system');
  });

  it('forwards click handlers', () => {
    const onClick = vi.fn();

    render(<CalcButton label="=" variant="operator" onClick={onClick} />);

    const button = getButton();

    button.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes wide and active state markers for layout and styling', () => {
    render(<CalcButton label="0" wide active />);

    const button = getButton();

    expect(button.getAttribute('data-wide')).toBe('true');
    expect(button.getAttribute('data-active')).toBe('true');
  });
});

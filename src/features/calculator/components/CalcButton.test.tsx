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

  function getContentFrame() {
    const contentFrame = container.querySelector(
      '[data-slot="button-content"]',
    );

    if (!contentFrame) {
      throw new Error('Expected calculator button content frame to render.');
    }

    return contentFrame;
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

  it('uses a shared content frame with layout markers for narrow and wide keys', () => {
    render(<CalcButton label="1" />);

    expect(getContentFrame().getAttribute('data-content-layout')).toBe(
      'centered',
    );

    render(<CalcButton label="0" wide />);

    expect(getContentFrame().getAttribute('data-content-layout')).toBe(
      'leading-column',
    );
  });
});

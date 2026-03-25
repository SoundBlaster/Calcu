import { describe, expect, it } from 'vitest';
import {
  mapKeyboardInputToActionId,
  shouldIgnoreCalculatorKeyboardEvent,
} from './keyboardInput';

function createKeyboardEvent(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    key,
    ...init,
  });
}

function withTarget<T extends KeyboardEvent>(event: T, target: EventTarget): T {
  Object.defineProperty(event, 'target', {
    configurable: true,
    value: target,
  });

  return event;
}

describe('keyboardInput', () => {
  it('maps supported keyboard keys to calculator action ids', () => {
    expect(mapKeyboardInputToActionId(createKeyboardEvent('7'))).toBe(
      'digit:7',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('.'))).toBe(
      'command:decimal',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('+'))).toBe(
      'binary:add',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('-'))).toBe(
      'binary:subtract',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('*'))).toBe(
      'binary:multiply',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('/'))).toBe(
      'binary:divide',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('='))).toBe(
      'command:equals',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('Enter'))).toBe(
      'command:equals',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('Backspace'))).toBe(
      'command:backspace',
    );
    expect(mapKeyboardInputToActionId(createKeyboardEvent('Escape'))).toBe(
      'command:all-clear',
    );
  });

  it('ignores composing and modifier-assisted keyboard input', () => {
    expect(
      mapKeyboardInputToActionId(
        createKeyboardEvent('1', { isComposing: true }),
      ),
    ).toBeNull();
    expect(
      mapKeyboardInputToActionId(createKeyboardEvent('1', { ctrlKey: true })),
    ).toBeNull();
    expect(
      mapKeyboardInputToActionId(createKeyboardEvent('1', { metaKey: true })),
    ).toBeNull();
    expect(
      mapKeyboardInputToActionId(createKeyboardEvent('1', { altKey: true })),
    ).toBeNull();
    expect(mapKeyboardInputToActionId(createKeyboardEvent('F1'))).toBeNull();
  });

  it('ignores editable targets and focused button Enter activation', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', {
      configurable: true,
      value: true,
    });
    const button = document.createElement('button');

    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('1'), input),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('1'), textarea),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('1'), select),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('1'), editable),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('Enter'), button),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreCalculatorKeyboardEvent(
        withTarget(createKeyboardEvent('Enter'), document.body),
      ),
    ).toBe(false);
  });
});

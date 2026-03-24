import type { CalculatorKeyActionId } from '../config';

type KeyboardInput = Readonly<{
  altKey: boolean;
  ctrlKey: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
}>;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function mapKeyboardInputToActionId(
  event: KeyboardInput,
): CalculatorKeyActionId | null {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  if (event.key >= '0' && event.key <= '9') {
    return `digit:${event.key}` as CalculatorKeyActionId;
  }

  switch (event.key) {
    case '.':
      return 'command:decimal';
    case '+':
      return 'binary:add';
    case '-':
      return 'binary:subtract';
    case '*':
      return 'binary:multiply';
    case '/':
      return 'binary:divide';
    case '=':
    case 'Enter':
      return 'command:equals';
    case 'Backspace':
      return 'command:backspace';
    case 'Escape':
      return 'command:all-clear';
    default:
      return null;
  }
}

export function shouldIgnoreCalculatorKeyboardEvent(event: KeyboardEvent) {
  return isEditableTarget(event.target);
}

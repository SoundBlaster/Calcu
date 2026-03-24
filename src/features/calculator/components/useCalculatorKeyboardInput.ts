import { useEffect } from 'react';
import type { CalculatorKeyActionId } from '../config';
import {
  mapKeyboardInputToActionId,
  shouldIgnoreCalculatorKeyboardEvent,
} from '../lib';

export function useCalculatorKeyboardInput(
  dispatch: (actionId: CalculatorKeyActionId) => void,
) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreCalculatorKeyboardEvent(event)) {
        return;
      }

      const actionId = mapKeyboardInputToActionId(event);

      if (!actionId) {
        return;
      }

      event.preventDefault();
      dispatch(actionId);
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]);
}

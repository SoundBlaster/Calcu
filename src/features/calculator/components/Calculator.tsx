import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  type CalculatorKeyActionId,
  type CalculatorKeyDefinition,
  type CalculatorViewportMode,
  getLandscapeScientificKeyRows,
} from '../config';
import { initialCalculatorState, reduceCalculatorState } from '../model';
import styles from './Calculator.module.css';
import { Display } from './Display';
import { Keypad } from './Keypad';

function getViewportMode(): CalculatorViewportMode {
  if (typeof window === 'undefined') {
    return 'portrait';
  }

  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

function formatDisplayValue(value: string) {
  return value === 'Error' ? value : value.replace('.', ',');
}

export function Calculator() {
  const [state, dispatch] = useReducer(
    reduceCalculatorState,
    initialCalculatorState,
  );
  const [viewportMode, setViewportMode] =
    useState<CalculatorViewportMode>(getViewportMode);

  useEffect(() => {
    function handleResize() {
      setViewportMode(getViewportMode());
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isLandscape = viewportMode === 'landscape';
  const activeActionIds = useMemo(() => {
    const nextActionIds = new Set<CalculatorKeyActionId>();

    if (state.secondMode) {
      nextActionIds.add('mode:toggle-second');
    }

    return nextActionIds.size > 0 ? nextActionIds : undefined;
  }, [state.secondMode]);
  const keypadRows = isLandscape
    ? getLandscapeScientificKeyRows(state.secondMode)
    : undefined;
  const modeStatus = state.angleMode === 'deg' ? 'Deg' : 'Rad';

  function handleKeyPress(key: CalculatorKeyDefinition) {
    dispatch(key.actionId);
  }

  return (
    <section
      className={[styles.calculator, isLandscape ? styles.landscape : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={isLandscape ? 'Landscape calculator' : 'Portrait calculator'}
    >
      {isLandscape ? (
        <div className={styles.topBar}>
          <p className={styles.modeStatus}>{modeStatus}</p>
          <Display
            ariaLabel="Calculator display"
            className={styles.landscapeDisplay}
            value={formatDisplayValue(state.displayValue)}
          />
        </div>
      ) : (
        <Display value={formatDisplayValue(state.displayValue)} />
      )}

      <Keypad
        activeActionIds={activeActionIds}
        ariaLabel={
          isLandscape ? 'Landscape scientific keypad' : 'Portrait keypad'
        }
        layout={isLandscape ? 'landscape' : 'portrait'}
        onKeyPress={handleKeyPress}
        rows={keypadRows}
      />
    </section>
  );
}

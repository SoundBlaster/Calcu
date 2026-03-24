import { useEffect, useState } from 'react';
import { Display, Keypad } from '../features/calculator/components';
import {
  type CalculatorKeyDefinition,
  type CalculatorViewportMode,
  getLandscapeScientificKeyRows,
} from '../features/calculator/config';
import styles from './App.module.css';

function getViewportMode(): CalculatorViewportMode {
  if (typeof window === 'undefined') {
    return 'portrait';
  }

  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

export function App() {
  const [viewportMode, setViewportMode] =
    useState<CalculatorViewportMode>(getViewportMode);
  const [secondMode, setSecondMode] = useState(false);

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
  const activeActionIds = secondMode
    ? new Set(['mode:toggle-second'] as const)
    : undefined;
  const keypadRows = isLandscape
    ? getLandscapeScientificKeyRows(secondMode)
    : undefined;

  function handleKeyPress(key: CalculatorKeyDefinition) {
    if (key.actionId === 'mode:toggle-second') {
      setSecondMode((currentValue) => !currentValue);
    }
  }

  return (
    <main className={styles.page}>
      <section
        className={[styles.stage, isLandscape ? styles.landscapeStage : '']
          .filter(Boolean)
          .join(' ')}
        aria-label={
          isLandscape
            ? 'Landscape calculator preview'
            : 'Portrait calculator preview'
        }
      >
        {isLandscape ? (
          <div className={styles.topBar}>
            <p className={styles.modeStatus}>Rad</p>
            <Display className={styles.landscapeDisplay} value="0" />
          </div>
        ) : (
          <Display value="0" />
        )}
        <Keypad
          activeActionIds={activeActionIds}
          ariaLabel={
            isLandscape
              ? 'Landscape scientific keypad'
              : 'Portrait calculator keypad'
          }
          layout={isLandscape ? 'landscape' : 'portrait'}
          onKeyPress={isLandscape ? handleKeyPress : undefined}
          rows={keypadRows}
        />
      </section>
    </main>
  );
}

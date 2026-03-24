import { CalcButton, Display } from '../features/calculator/components';
import {
  isWideCalculatorKey,
  portraitKeyRows,
} from '../features/calculator/config';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.page}>
      <section
        className={styles.stage}
        aria-label="Calculator visual foundation"
      >
        <Display value="0" />

        <div className={styles.keypad}>
          {portraitKeyRows.map((row) => (
            <div
              className={styles.keyRow}
              key={row.map((key) => key.label).join('-')}
            >
              {row.map((key) => (
                <CalcButton
                  aria-label={key.label}
                  key={key.actionId}
                  label={key.label}
                  variant={key.variant}
                  wide={isWideCalculatorKey(key)}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

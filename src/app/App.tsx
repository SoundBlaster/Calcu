import {
  CalcButton,
  type CalcButtonVariant,
  Display,
} from '../features/calculator/components';
import styles from './App.module.css';

type PreviewKey = {
  label: string;
  active?: boolean;
  variant?: CalcButtonVariant;
  wide?: boolean;
};

const keypadRows: ReadonlyArray<ReadonlyArray<PreviewKey>> = [
  [
    { label: 'AC', variant: 'system' },
    { label: '+/-', variant: 'system' },
    { label: '%', variant: 'system' },
    { label: '÷', variant: 'operator' },
  ],
  [
    { label: '7' },
    { label: '8' },
    { label: '9' },
    { label: '×', variant: 'operator' },
  ],
  [
    { label: '4' },
    { label: '5' },
    { label: '6' },
    { label: '-', variant: 'operator' },
  ],
  [
    { label: '1' },
    { label: '2' },
    { label: '3' },
    { label: '+', variant: 'operator' },
  ],
  [
    { label: '0', wide: true },
    { label: ',' },
    { label: '=', variant: 'operator' },
  ],
];

export function App() {
  return (
    <main className={styles.page}>
      <section
        className={styles.stage}
        aria-label="Calculator visual foundation"
      >
        <Display value="0" />

        <div className={styles.keypad}>
          {keypadRows.map((row) => (
            <div
              className={styles.keyRow}
              key={row.map((key) => key.label).join('-')}
            >
              {row.map((key) => (
                <CalcButton
                  active={key.active}
                  aria-label={key.label}
                  key={key.label}
                  label={key.label}
                  variant={key.variant}
                  wide={key.wide}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

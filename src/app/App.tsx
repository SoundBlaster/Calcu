import styles from './App.module.css';

type PreviewKey = {
  label: string;
  tone?: 'operator' | 'system';
  wide?: boolean;
};

const keypadRows: ReadonlyArray<ReadonlyArray<PreviewKey>> = [
  [
    { label: 'AC', tone: 'system' },
    { label: '+/-', tone: 'system' },
    { label: '%', tone: 'system' },
    { label: '÷', tone: 'operator' },
  ],
  [
    { label: '7' },
    { label: '8' },
    { label: '9' },
    { label: '×', tone: 'operator' },
  ],
  [
    { label: '4' },
    { label: '5' },
    { label: '6' },
    { label: '-', tone: 'operator' },
  ],
  [
    { label: '1' },
    { label: '2' },
    { label: '3' },
    { label: '+', tone: 'operator' },
  ],
  [
    { label: '0', wide: true },
    { label: ',' },
    { label: '=', tone: 'operator' },
  ],
];

function getKeyClassName(tone?: 'operator' | 'system', wide?: boolean) {
  return [
    styles.key,
    tone === 'system' ? styles.system : '',
    tone === 'operator' ? styles.operator : '',
    wide ? styles.zero : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function App() {
  return (
    <main className={styles.page}>
      <section
        className={styles.stage}
        aria-label="Calculator visual foundation"
      >
        <div className={styles.display}>
          <span className={styles.displayValue}>0</span>
        </div>

        <div className={styles.keypad}>
          {keypadRows.map((row) => (
            <div
              className={styles.keyRow}
              key={row.map((key) => key.label).join('-')}
            >
              {row.map((key) => (
                <span
                  className={getKeyClassName(key.tone, key.wide)}
                  key={key.label}
                >
                  {key.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

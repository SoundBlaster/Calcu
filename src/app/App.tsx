import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.page}>
      <section className={styles.stage}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Calcu</p>
          <h1 className={styles.title}>Visual-first calculator scaffold</h1>
          <p className={styles.copy}>
            The app shell is ready for responsive layout, button system, and
            keypad styling tasks.
          </p>
        </header>

        <div className={styles.preview}>
          <div className={styles.display}>
            <span className={styles.displayValue}>0</span>
          </div>

          <div className={styles.keypad}>
            <div className={styles.keyRow}>
              <span className={`${styles.key} ${styles.system}`}>AC</span>
              <span className={`${styles.key} ${styles.system}`}>+/-</span>
              <span className={`${styles.key} ${styles.system}`}>%</span>
              <span className={`${styles.key} ${styles.operator}`}>÷</span>
            </div>
            <div className={styles.keyRow}>
              <span className={styles.key}>7</span>
              <span className={styles.key}>8</span>
              <span className={styles.key}>9</span>
              <span className={`${styles.key} ${styles.operator}`}>×</span>
            </div>
            <div className={styles.keyRow}>
              <span className={styles.key}>4</span>
              <span className={styles.key}>5</span>
              <span className={styles.key}>6</span>
              <span className={`${styles.key} ${styles.operator}`}>-</span>
            </div>
            <div className={styles.keyRow}>
              <span className={styles.key}>1</span>
              <span className={styles.key}>2</span>
              <span className={styles.key}>3</span>
              <span className={`${styles.key} ${styles.operator}`}>+</span>
            </div>
            <div className={styles.keyRow}>
              <span className={`${styles.key} ${styles.zero}`}>0</span>
              <span className={styles.key}>,</span>
              <span className={`${styles.key} ${styles.operator}`}>=</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

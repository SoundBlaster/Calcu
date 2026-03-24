import { Display, Keypad } from '../features/calculator/components';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.page}>
      <section
        className={styles.stage}
        aria-label="Portrait calculator preview"
      >
        <Display value="0" />
        <Keypad />
      </section>
    </main>
  );
}

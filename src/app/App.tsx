import { AgentTaskPanel } from '../features/agent-task';
import { Calculator } from '../features/calculator/components';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.page}>
      <div className={styles.workspace}>
        <AgentTaskPanel />
        <Calculator />
      </div>
    </main>
  );
}

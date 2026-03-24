import {
  type CalculatorKeyActionId,
  type CalculatorKeyDefinition,
  type CalculatorKeyRow,
  isWideCalculatorKey,
  portraitKeyRows,
} from '../config';
import { CalcButton } from './CalcButton';
import styles from './Keypad.module.css';

export type KeypadLayout = 'portrait';

export type KeypadProps = {
  activeActionIds?: ReadonlySet<CalculatorKeyActionId>;
  ariaLabel?: string;
  className?: string;
  layout?: KeypadLayout;
  onKeyPress?: (key: CalculatorKeyDefinition) => void;
  rows?: ReadonlyArray<CalculatorKeyRow>;
};

export function Keypad({
  activeActionIds,
  ariaLabel = 'Calculator keypad',
  className,
  layout = 'portrait',
  onKeyPress,
  rows = portraitKeyRows,
}: KeypadProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={[styles.keypad, styles[layout], className]
        .filter(Boolean)
        .join(' ')}
    >
      {rows.map((row) => (
        <div className={styles.row} key={row.map((key) => key.label).join('-')}>
          {row.map((key) => (
            <CalcButton
              active={activeActionIds?.has(key.actionId) ?? false}
              aria-label={key.label}
              key={key.actionId}
              label={key.label}
              onClick={onKeyPress ? () => onKeyPress(key) : undefined}
              variant={key.variant}
              wide={isWideCalculatorKey(key)}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

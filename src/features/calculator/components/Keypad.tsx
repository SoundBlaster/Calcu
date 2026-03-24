import {
  type CalculatorKeyActionId,
  type CalculatorKeyDefinition,
  type CalculatorKeyRow,
  getLandscapeScientificKeyRows,
  isWideCalculatorKey,
  portraitKeyRows,
} from '../config';
import { CalcButton } from './CalcButton';
import styles from './Keypad.module.css';

export type KeypadLayout = 'landscape' | 'portrait';

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
  rows = layout === 'landscape'
    ? getLandscapeScientificKeyRows(false)
    : portraitKeyRows,
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
          {row.map((key) => {
            const isActive = activeActionIds?.has(key.actionId) ?? false;
            const variant =
              isActive && key.actionId === 'mode:toggle-second'
                ? 'system'
                : key.variant;

            return (
              <CalcButton
                active={isActive}
                aria-label={key.label}
                key={key.actionId}
                label={key.label}
                onClick={onKeyPress ? () => onKeyPress(key) : undefined}
                variant={variant}
                wide={isWideCalculatorKey(key)}
              />
            );
          })}
        </div>
      ))}
    </section>
  );
}

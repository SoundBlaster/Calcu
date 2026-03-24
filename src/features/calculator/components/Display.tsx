import styles from './Display.module.css';

export type DisplayProps = {
  ariaLabel?: string;
  className?: string;
  value: string;
};

type DisplayScale = 'compact' | 'compressed' | 'default';

function getDisplayScale(value: string): DisplayScale {
  const normalizedValue = value.replace(/\s+/g, '');

  if (normalizedValue.length >= 18) {
    return 'compressed';
  }

  if (normalizedValue.length >= 13) {
    return 'compact';
  }

  return 'default';
}

export function Display({
  ariaLabel = 'Calculator display',
  className,
  value,
}: DisplayProps) {
  return (
    <div className={[styles.display, className].filter(Boolean).join(' ')}>
      <div className={styles.frame}>
        <output
          aria-atomic="true"
          aria-label={ariaLabel}
          aria-live="polite"
          className={styles.value}
          data-scale={getDisplayScale(value)}
        >
          {value}
        </output>
      </div>
    </div>
  );
}

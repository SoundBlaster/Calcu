import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './CalcButton.module.css';

export type CalcButtonVariant = 'input' | 'operator' | 'system';

export type CalcButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  active?: boolean;
  label: ReactNode;
  variant?: CalcButtonVariant;
  wide?: boolean;
};

export function CalcButton({
  active = false,
  className,
  label,
  type = 'button',
  variant = 'input',
  wide = false,
  ...buttonProps
}: CalcButtonProps) {
  const contentLayout = wide ? 'leading-column' : 'centered';

  return (
    <button
      className={[
        styles.button,
        styles[variant],
        wide ? styles.wide : '',
        active ? styles.active : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-active={active ? 'true' : 'false'}
      data-variant={variant}
      data-wide={wide ? 'true' : 'false'}
      type={type}
      {...buttonProps}
    >
      <span
        className={styles.content}
        data-content-layout={contentLayout}
        data-slot="button-content"
      >
        <span className={styles.label}>{label}</span>
      </span>
    </button>
  );
}

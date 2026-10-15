import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  large?: boolean;
}

export function Button({
  variant = 'secondary',
  large,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], large && styles.large, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

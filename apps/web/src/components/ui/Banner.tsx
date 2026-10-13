import type { ReactNode } from 'react';
import styles from './Banner.module.css';

interface Props {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}

const LABEL = { info: 'Info', warning: 'Warning', error: 'Error' } as const;

/** Status is conveyed by an icon and label as well as color. */
export function Banner({ tone = 'info', children }: Props) {
  const icon = tone === 'info' ? 'ℹ' : tone === 'warning' ? '⚠' : '✖';
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`${styles.banner} ${styles[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      <span className="visually-hidden">{LABEL[tone]}: </span>
      <span>{children}</span>
    </div>
  );
}

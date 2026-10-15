import type { ReactNode } from 'react';
import { CircleAlert, Icon, Info, TriangleAlert } from './Icon';
import styles from './Banner.module.css';

interface Props {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}

const LABEL = { info: 'Info', warning: 'Warning', error: 'Error' } as const;

/** Status is conveyed by an icon and label as well as color. */
export function Banner({ tone = 'info', children }: Props) {
  const icon = tone === 'info' ? Info : tone === 'warning' ? TriangleAlert : CircleAlert;
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`${styles.banner} ${styles[tone]}`}>
      <Icon as={icon} />
      <span className="visually-hidden">{LABEL[tone]}: </span>
      <span>{children}</span>
    </div>
  );
}

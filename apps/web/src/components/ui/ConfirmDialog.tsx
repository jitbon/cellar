import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <div>{children}</div>
      <div className={styles.actions}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

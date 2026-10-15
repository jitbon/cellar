import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 8000;

function tipKey(tipId: string): string {
  return `cellar:tip:${tipId}`;
}

function isDismissed(tipId: string): boolean {
  try {
    return localStorage.getItem(tipKey(tipId)) === 'dismissed';
  } catch {
    return false;
  }
}

/** One-time tip: visible until dismissed once on this device. */
export function useTip(tipId: string): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(() => !isDismissed(tipId));
  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(tipKey(tipId), 'dismissed');
    } catch {
      // Storage unavailable: the tip simply reappears next visit.
    }
  }, [tipId]);
  return { visible, dismiss };
}

interface Props {
  children: ReactNode;
  onDismiss: () => void;
}

/** Bottom-center status toast; auto-dismisses after 8 s, paused while hovered or focused. */
export function Toast({ children, onDismiss }: Props) {
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [paused]);

  return (
    <div
      role="status"
      className={styles.toast}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{children}</span>
      <Button variant="ghost" className={styles.dismiss} onClick={onDismiss}>
        Got it
      </Button>
    </div>
  );
}

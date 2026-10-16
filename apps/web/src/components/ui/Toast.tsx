import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 8000;
const FADE_MS = 300;

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
  /** How long it stays before fading out. */
  durationMs?: number;
  actionLabel?: string;
  /** Defaults to dismissing. */
  onAction?: () => void;
}

/**
 * Bottom-center status toast; fades out and dismisses after `durationMs` (8 s by default),
 * paused while hovered or focused.
 */
export function Toast({
  children,
  onDismiss,
  durationMs = AUTO_DISMISS_MS,
  actionLabel = 'Got it',
  onAction,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (paused) return;
    if (leaving) {
      const timer = setTimeout(() => dismissRef.current(), FADE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setLeaving(true), durationMs);
    return () => clearTimeout(timer);
  }, [paused, leaving, durationMs]);

  return (
    <div
      role="status"
      className={`${styles.toast} ${leaving ? styles.leaving : ''}`}
      onMouseEnter={() => {
        setPaused(true);
        setLeaving(false);
      }}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{children}</span>
      <Button variant="ghost" className={styles.dismiss} onClick={onAction ?? onDismiss}>
        {actionLabel}
      </Button>
    </div>
  );
}

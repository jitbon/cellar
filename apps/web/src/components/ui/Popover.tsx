import { useEffect, type ReactNode, type RefObject } from 'react';
import styles from './Popover.module.css';

interface Props {
  id: string;
  /** The popover's trigger wrapper: it is positioned relative to it, and taps inside it do not close it. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A small panel under its anchor. Closes on Escape or a tap/click outside the anchor.
 * Render it only while open; the parent decides when to open it.
 */
export function Popover({ id, anchorRef, onClose, children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointerDown(e: PointerEvent) {
      if (!anchorRef.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div id={id} className={styles.popover}>
      {children}
    </div>
  );
}

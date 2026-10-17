import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useAnchoredPosition } from './useAnchoredPosition';
import styles from './Popover.module.css';

interface Props {
  id: string;
  /** The popover's trigger wrapper: it is placed next to it, and taps inside it do not close it. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A small panel under its anchor (above when there is no room below). It stays next to its
 * trigger in the page, so Tab moves into it, but is placed against the window so scroll areas
 * never clip it. Closes on Escape or a tap/click outside the anchor and the panel.
 * Render it only while open; the parent decides when to open it.
 */
export function Popover({ id, anchorRef, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const style = useAnchoredPosition(anchorRef, ref);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element;
      // Menus and dialogs opened from inside the popover live in portals.
      if (target.closest?.('[role="menu"], [role="dialog"]')) return;
      if (anchorRef.current?.contains(target) || ref.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div ref={ref} id={id} className={styles.popover} data-popover style={style}>
      {children}
    </div>
  );
}

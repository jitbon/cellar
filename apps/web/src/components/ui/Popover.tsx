import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './Popover.module.css';

interface Props {
  id: string;
  /** The popover's trigger wrapper: it is placed next to it, and taps inside it do not close it. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

const GAP = 4;
const MARGIN = 8;

/**
 * A small panel under its anchor (above when there is no room below). It stays next to its
 * trigger in the page, so Tab moves into it, but is placed against the window so scroll areas
 * never clip it. Closes on Escape or a tap/click outside the anchor and the panel.
 * Render it only while open; the parent decides when to open it.
 */
export function Popover({ id, anchorRef, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = ref.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const below = anchor.bottom + GAP;
      const above = anchor.top - GAP - panel.height;
      const maxTop = window.innerHeight - MARGIN - panel.height;
      const top = below <= maxTop ? below : above >= MARGIN ? above : Math.max(MARGIN, maxTop);
      const maxLeft = window.innerWidth - MARGIN - panel.width;
      const left = Math.max(MARGIN, Math.min(anchor.right - panel.width, maxLeft));
      setPosition((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (ref.current) observer?.observe(ref.current);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
  }, [anchorRef]);

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
    <div
      ref={ref}
      id={id}
      className={styles.popover}
      data-popover
      style={position ?? { visibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

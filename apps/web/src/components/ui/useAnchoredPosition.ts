import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const GAP = 4;
const MARGIN = 8;

/**
 * Places a `position: fixed` panel next to its anchor: below it, or above when there is no room
 * below, and inside the window. Fixed placement keeps the panel in its place in the DOM (so Tab
 * order and focus checks still work) while scroll areas can no longer clip it. Follows scrolling,
 * resizing and changes to the panel's size. Returns the panel's style; it stays hidden until placed.
 */
export function useAnchoredPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  { align = 'end', matchWidth = false }: { align?: 'start' | 'end'; matchWidth?: boolean } = {},
): CSSProperties {
  const [style, setStyle] = useState<{ top: number; left: number; minWidth?: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const minWidth = matchWidth ? anchor.width : undefined;
      const width = Math.max(panel.width, minWidth ?? 0);
      const below = anchor.bottom + GAP;
      const above = anchor.top - GAP - panel.height;
      const maxTop = window.innerHeight - MARGIN - panel.height;
      const top = below <= maxTop ? below : above >= MARGIN ? above : Math.max(MARGIN, maxTop);
      const maxLeft = window.innerWidth - MARGIN - width;
      const left = Math.max(
        MARGIN,
        Math.min(align === 'end' ? anchor.right - width : anchor.left, maxLeft),
      );
      setStyle((s) =>
        s && s.top === top && s.left === left && s.minWidth === minWidth
          ? s
          : { top, left, minWidth },
      );
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
  }, [anchorRef, panelRef, align, matchWidth]);

  return style ?? { visibility: 'hidden' };
}

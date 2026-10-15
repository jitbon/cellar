import { createPortal } from 'react-dom';
import { DragOverlay } from '@dnd-kit/core';
import type { TripState } from '@cellar/core';
import { ChipFace } from './PlacementChip';
import { parsePrefixed } from './dndIds';
import styles from './DragLayer.module.css';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** The lifted chip that follows the pointer while dragging a placement or a list item. */
export function DragLayer({ state, activeId }: { state: TripState; activeId: string | null }) {
  const placementId = activeId ? parsePrefixed(activeId, 'placement') : null;
  const itemId = activeId ? parsePrefixed(activeId, 'item') : null;
  const source = placementId
    ? state.placements.find((p) => p.id === placementId)
    : itemId
      ? state.items.find((i) => i.id === itemId)
      : undefined;
  const reduced = prefersReducedMotion();

  return createPortal(
    <DragOverlay
      zIndex={200}
      dropAnimation={reduced ? null : { duration: 180, easing: 'ease-out' }}
    >
      {source ? (
        <div
          className={`${styles.lifted} ${styles[source.type]} ${reduced ? styles.flat : ''}`}
          data-drag-overlay
        >
          <ChipFace name={source.name} type={source.type} />
        </div>
      ) : null}
    </DragOverlay>,
    document.body,
  );
}

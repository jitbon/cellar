import { createPortal } from 'react-dom';
import { DragOverlay } from '@dnd-kit/core';
import { placeOf, type ItemType, type PopularPlace, type TripState } from '@cellar/core';
import { ChipFace } from './PlacementChip';
import { parsePrefixed } from './dndIds';
import styles from './DragLayer.module.css';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** What a Popular card carries while dragged. */
export interface PopularDrag {
  place: PopularPlace;
  type: ItemType;
}

/** The lifted chip that follows the pointer while dragging a placement, list item or Popular card. */
export function DragLayer({
  state,
  activeId,
  popular = null,
}: {
  state: TripState;
  activeId: string | null;
  popular?: PopularDrag | null;
}) {
  const placementId = activeId ? parsePrefixed(activeId, 'placement') : null;
  const itemId = activeId ? parsePrefixed(activeId, 'item') : null;
  const source = placementId
    ? state.placements.find((p) => p.id === placementId)
    : itemId
      ? state.items.find((i) => i.id === itemId)
      : undefined;
  const face = source
    ? { name: source.name, type: source.type, linked: placeOf(source) !== null }
    : popular && activeId && parsePrefixed(activeId, 'popular')
      ? { name: popular.place.name, type: popular.type, linked: true }
      : null;
  const reduced = prefersReducedMotion();

  return createPortal(
    <DragOverlay
      zIndex={200}
      dropAnimation={reduced ? null : { duration: 180, easing: 'ease-out' }}
    >
      {face ? (
        <div
          className={`${styles.lifted} ${styles[face.type]} ${reduced ? styles.flat : ''}`}
          data-drag-overlay
        >
          <ChipFace name={face.name} type={face.type} linked={face.linked} />
        </div>
      ) : null}
    </DragOverlay>,
    document.body,
  );
}

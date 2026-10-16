import type { RefObject } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ISODate, Placement, TripState } from '@cellar/core';
import { Popover } from '../ui/Popover';
import { cellListDropId, placementDragId } from './dndIds';
import { PlacementChip, type Dispatch } from './PlacementChip';
import styles from './CellListPopover.module.css';

interface Props {
  state: TripState;
  date: ISODate;
  blockId: string;
  blockName: string;
  placements: Placement[];
  dispatch: Dispatch;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/** Every event in a crowded cell, as a sortable list that is also a drop target for that cell. */
export function CellListPopover({
  state,
  date,
  blockId,
  blockName,
  placements,
  dispatch,
  anchorRef,
  onClose,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: cellListDropId(date, blockId) });
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
  });
  return (
    <Popover id={`cell-list-${date}-${blockId}`} anchorRef={anchorRef} onClose={onClose}>
      <div
        ref={setNodeRef}
        className={styles.list}
        data-drop-area
        data-drop-target={isOver ? 'true' : undefined}
        role="group"
        aria-label={`All events in ${blockName} on ${date}`}
      >
        <h3 className={styles.title}>
          {weekday} · {blockName}
        </h3>
        <SortableContext
          items={placements.map((p) => placementDragId(p.id))}
          strategy={verticalListSortingStrategy}
        >
          {placements.map((p) => (
            <PlacementChip key={p.id} state={state} placement={p} dispatch={dispatch} />
          ))}
        </SortableContext>
      </div>
    </Popover>
  );
}

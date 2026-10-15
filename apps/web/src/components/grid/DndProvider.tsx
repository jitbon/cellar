import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  cell,
  moveBlock,
  movePlacement,
  orderedBlocks,
  placeItem,
  type TripState,
} from '@cellar/core';
import { parseCellDropId, parsePrefixed } from './dndIds';
import type { Dispatch } from './PlacementChip';

/** Prefer a placement under the pointer (insert before it), else the cell. */
const collisionDetection: CollisionDetection = (args) => {
  if (String(args.active.id).startsWith('block:')) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith('block:'),
      ),
    });
  }
  const hits = pointerWithin(args);
  const all = hits.length > 0 ? hits : rectIntersection(args);
  const placement = all.find(
    (c) => String(c.id).startsWith('placement:') && c.id !== args.active.id,
  );
  return placement ? [placement] : all.filter((c) => /^cell(list)?\|/.test(String(c.id)));
};

interface Props {
  state: TripState;
  dispatch: Dispatch;
  children: ReactNode;
}

export function DndProvider({ state, dispatch, children }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number): string => {
    const key = String(id);
    const placementId = parsePrefixed(key, 'placement');
    if (placementId) return state.placements.find((p) => p.id === placementId)?.name ?? 'event';
    const itemId = parsePrefixed(key, 'item');
    if (itemId) return state.items.find((i) => i.id === itemId)?.name ?? 'item';
    const blockId = parsePrefixed(key, 'block');
    if (blockId) return state.blocks.find((b) => b.id === blockId)?.name ?? 'block';
    const target = parseCellDropId(key);
    if (target) {
      const block = state.blocks.find((b) => b.id === target.blockId)?.name ?? 'block';
      return `${block} on ${target.date}`;
    }
    return key;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} is over ${nameOf(over.id)}.`
        : `${nameOf(active.id)} is not over a cell.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${nameOf(active.id)} on ${nameOf(over.id)}.`
        : `Dropped ${nameOf(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelled moving ${nameOf(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const movingBlockId = parsePrefixed(activeId, 'block');
    if (movingBlockId) {
      const overBlockId = parsePrefixed(overId, 'block');
      if (!overBlockId || overBlockId === movingBlockId) return;
      const order = orderedBlocks(state);
      const from = order.findIndex((b) => b.id === movingBlockId);
      const to = order.findIndex((b) => b.id === overBlockId);
      // Dragging down lands after the target; dragging up lands before it.
      dispatch(moveBlock(movingBlockId, from < to ? order[to + 1]?.id : overBlockId));
      return;
    }

    let date: string;
    let blockId: string;
    let beforeId: string | undefined;

    const overPlacementId = parsePrefixed(overId, 'placement');
    const overCell = parseCellDropId(overId);
    if (overPlacementId) {
      const target = state.placements.find((p) => p.id === overPlacementId);
      if (!target) return;
      date = target.date;
      blockId = target.blockId;
      beforeId = target.id;
    } else if (overCell) {
      ({ date, blockId } = overCell);
    } else {
      return;
    }

    const itemId = parsePrefixed(activeId, 'item');
    if (itemId) {
      dispatch(placeItem(itemId, date, blockId, beforeId));
      return;
    }

    const movingId = parsePrefixed(activeId, 'placement');
    if (!movingId || movingId === beforeId) return;
    const moving = state.placements.find((p) => p.id === movingId);
    if (!moving) return;

    // Dragging down within one cell lands after the target, like a sortable list.
    if (beforeId && moving.date === date && moving.blockId === blockId) {
      const order = cell(state, date, blockId);
      const from = order.findIndex((p) => p.id === movingId);
      const to = order.findIndex((p) => p.id === beforeId);
      if (from < to) beforeId = order[to + 1]?.id;
    }
    dispatch(movePlacement(movingId, date, blockId, beforeId));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements }}
      onDragEnd={onDragEnd}
    >
      {children}
    </DndContext>
  );
}

import { useState, type ReactNode } from 'react';
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
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  cell,
  moveBlock,
  movePlacement,
  orderedBlocks,
  placeItem,
  placePlace,
  popularToPlace,
  type TripState,
} from '@cellar/core';
import { DragOverContext, parseCellDropId, parsePrefixed } from './dndIds';
import { DragLayer, type PopularDrag } from './DragLayer';
import type { Dispatch } from './PlacementChip';

/** Mouse and pen only: touch is handled by TouchSensor's long press, so scrolling still works. */
class MousePointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: 'onPointerDown',
      handler: ({ nativeEvent: event }, { onActivation }) => {
        if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** Prefer a placement under the pointer (insert before it), else the cell. */
/**
 * Whether the pointer is over a place where things can be dropped: the visible grid or an open
 * cell list. Droppable cells keep their layout position when they are scrolled out of the grid
 * (e.g. later days behind the item panel), so their rectangles alone are not enough.
 */
function pointerOverDropArea({ x, y }: { x: number; y: number }): boolean {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return true;
  }
  // The lifted card follows the pointer, so look beneath it.
  const under = document.elementsFromPoint(x, y).find((el) => !el.closest('[data-drag-overlay]'));
  return !!under?.closest('[data-drop-area]');
}

const collisionDetection: CollisionDetection = (args) => {
  if (String(args.active.id).startsWith('block:')) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith('block:'),
      ),
    });
  }
  // A pointer drag that ends outside the grid (over the item panel, say) drops nowhere. Keyboard
  // drags have no pointer and keep using the dragged item's position.
  if (args.pointerCoordinates && !pointerOverDropArea(args.pointerCoordinates)) return [];
  // Pointer drags drop only on what is under the pointer, so a greyed (disabled) cell under it
  // never hands the drop to a neighbor. Keyboard drags have no pointer and use the item's rect.
  const all = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [popular, setPopular] = useState<PopularDrag | null>(null);
  const sensors = useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number, data?: PopularDrag | null): string => {
    const key = String(id);
    if (parsePrefixed(key, 'popular')) return data?.place.name ?? 'place';
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

  const popularData = (active: Active): PopularDrag | null =>
    parsePrefixed(String(active.id), 'popular')
      ? ((active.data.current as PopularDrag | undefined) ?? null)
      : null;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id, popularData(active))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id, popularData(active))} is over ${nameOf(over.id)}.`
        : `${nameOf(active.id, popularData(active))} is not over a cell.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${nameOf(active.id, popularData(active))} on ${nameOf(over.id)}.`
        : `Dropped ${nameOf(active.id, popularData(active))}.`,
    onDragCancel: ({ active }) => `Cancelled moving ${nameOf(active.id, popularData(active))}.`,
  };

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setPopular(popularData(active));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    setPopular(null);
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

    const dragged = popularData(active);
    if (dragged) {
      // Only the event is created; the traveler's list is untouched.
      dispatch(placePlace(popularToPlace(dragged.place), dragged.type, date, blockId, beforeId));
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
      autoScroll={{ threshold: { x: 0.1, y: 0.1 } }}
      onDragStart={onDragStart}
      onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverId(null);
        setPopular(null);
      }}
    >
      <DragOverContext.Provider value={overId}>{children}</DragOverContext.Provider>
      <DragLayer state={state} activeId={activeId} popular={popular} />
    </DndContext>
  );
}

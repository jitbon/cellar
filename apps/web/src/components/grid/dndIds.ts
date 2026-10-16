import { createContext, useContext } from 'react';
import type { ISODate } from '@cellar/core';

export const cellDropId = (date: ISODate, blockId: string) => `cell|${date}|${blockId}`;
/** The "+N more" popover is its own drop target for the same cell. */
export const cellListDropId = (date: ISODate, blockId: string) => `celllist|${date}|${blockId}`;
export const placementDragId = (id: string) => `placement:${id}`;
export const itemDragId = (id: string) => `item:${id}`;
export const blockDragId = (id: string) => `block:${id}`;
/** A Popular card, by provider place id; the card's place and type ride along as drag data. */
export const popularDragId = (placeId: string) => `popular:${placeId}`;

export function parseCellDropId(id: string): { date: ISODate; blockId: string } | null {
  const [kind, date, blockId] = id.split('|');
  return kind === 'cell' || kind === 'celllist' ? { date, blockId } : null;
}

export function parsePrefixed(
  id: string,
  prefix: 'placement' | 'item' | 'block' | 'popular',
): string | null {
  return id.startsWith(`${prefix}:`) ? id.slice(prefix.length + 1) : null;
}

/** Id of the droppable currently under a dragged item (null when idle); changes only while dragging. */
export const DragOverContext = createContext<string | null>(null);
export const useDragOverId = () => useContext(DragOverContext);

import type { ISODate } from '@cellar/core';

export const cellDropId = (date: ISODate, blockId: string) => `cell|${date}|${blockId}`;
export const placementDragId = (id: string) => `placement:${id}`;
export const itemDragId = (id: string) => `item:${id}`;
export const blockDragId = (id: string) => `block:${id}`;

export function parseCellDropId(id: string): { date: ISODate; blockId: string } | null {
  const [kind, date, blockId] = id.split('|');
  return kind === 'cell' ? { date, blockId } : null;
}

export function parsePrefixed(id: string, prefix: 'placement' | 'item' | 'block'): string | null {
  return id.startsWith(`${prefix}:`) ? id.slice(prefix.length + 1) : null;
}

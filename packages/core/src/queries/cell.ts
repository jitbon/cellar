import { comparePositioned } from '../model/ordering';
import type { ISODate, Placement, TripState } from '../model/types';

export function cell(state: TripState, date: ISODate, blockId: string): Placement[] {
  return state.placements
    .filter((p) => p.date === date && p.blockId === blockId)
    .sort(comparePositioned);
}

/** Blocks in display order (same comparator as placements). */
export function orderedBlocks(state: TripState) {
  return [...state.blocks].sort(comparePositioned);
}

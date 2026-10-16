import type { ISODate, TripState } from '../model/types';
import { orderedBlocks } from './cell';
import { placedCount } from './items';

/** True when any event on the schedule came from this list item. */
export const isItemPlaced = (state: TripState, itemId: string): boolean =>
  placedCount(state, itemId) > 0;

/** True when any list item or event in the trip is linked to this provider place. */
export const isPlacePlaced = (state: TripState, placeId: string): boolean =>
  state.placements.some((p) => p.placeId === placeId) ||
  state.items.some((i) => i.placeId === placeId);

/** Where a provider place is planned: each event of it, by date then block order. */
export function placementsOfPlace(
  state: TripState,
  placeId: string,
): { date: ISODate; blockName: string }[] {
  const order = new Map(orderedBlocks(state).map((b, i) => [b.id, i]));
  return state.placements
    .filter((p) => p.placeId === placeId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0),
    )
    .map((p) => ({
      date: p.date,
      blockName: state.blocks.find((b) => b.id === p.blockId)?.name ?? '',
    }));
}

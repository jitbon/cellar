import type { TripState } from '../model/types';
import { placedCount } from './items';

/** True when any event on the schedule came from this list item. */
export const isItemPlaced = (state: TripState, itemId: string): boolean =>
  placedCount(state, itemId) > 0;

/** True when any list item or event in the trip is linked to this provider place. */
export const isPlacePlaced = (state: TripState, placeId: string): boolean =>
  state.placements.some((p) => p.placeId === placeId) ||
  state.items.some((i) => i.placeId === placeId);

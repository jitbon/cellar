import { comparePositioned } from '../model/ordering';
import type { ISODate, TripState } from '../model/types';

export type GreyedSide = 'before-arrival' | 'after-departure';

/**
 * Why a cell is greyed: it comes before that day's arrival block or after its departure block
 * (FR-006a), or null when it is inside the travel window.
 */
export function greyedSide(state: TripState, date: ISODate, blockId: string): GreyedSide | null {
  const setting = state.daySettings.find((d) => d.date === date);
  if (!setting) return null;
  const order = [...state.blocks].sort(comparePositioned).map((b) => b.id);
  const at = order.indexOf(blockId);
  if (at < 0) return null;
  if (setting.arrivalBlockId !== null && at < order.indexOf(setting.arrivalBlockId)) {
    return 'before-arrival';
  }
  if (setting.departureBlockId !== null && at > order.indexOf(setting.departureBlockId)) {
    return 'after-departure';
  }
  return null;
}

/**
 * Blocks before arrival or after departure on that day (FR-006a). These cells take nothing new
 * (`validateCell`), but events already in them stay and can move out.
 */
export function isGreyed(state: TripState, date: ISODate, blockId: string): boolean {
  return greyedSide(state, date, blockId) !== null;
}

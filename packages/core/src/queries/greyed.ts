import { comparePositioned } from '../model/ordering';
import type { ISODate, TripState } from '../model/types';

/** Display only: blocks before arrival or after departure on that day (FR-006a). */
export function isGreyed(state: TripState, date: ISODate, blockId: string): boolean {
  const setting = state.daySettings.find((d) => d.date === date);
  if (!setting) return false;
  const order = [...state.blocks].sort(comparePositioned).map((b) => b.id);
  const at = order.indexOf(blockId);
  if (at < 0) return false;
  if (setting.arrivalBlockId !== null && at < order.indexOf(setting.arrivalBlockId)) return true;
  if (setting.departureBlockId !== null && at > order.indexOf(setting.departureBlockId)) {
    return true;
  }
  return false;
}

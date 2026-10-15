import { validationError } from '../model/errors';
import { comparePositioned } from '../model/ordering';
import type { DaySetting, ISODate } from '../model/types';
import type { Command } from './command';
import { locationOf } from '../queries/location';
import { commit } from './diff';

/** Sets (or, with both null/omitted, clears) the arrival and departure blocks for a day. */
export function setDayWindow(
  date: ISODate,
  arrivalBlockId: string | null = null,
  departureBlockId: string | null = null,
): Command {
  return (state) => {
    if (date < state.trip.startDate || date > state.trip.endDate) {
      return {
        ok: false,
        error: validationError('DATE_OUT_OF_RANGE', 'That date is outside the trip.'),
      };
    }
    const order = [...state.blocks].sort(comparePositioned).map((b) => b.id);
    const indexOf = (id: string | null) => (id === null ? null : order.indexOf(id));
    const arrival = indexOf(arrivalBlockId);
    const departure = indexOf(departureBlockId);
    if (arrival === -1 || departure === -1) {
      return { ok: false, error: validationError('NOT_FOUND', 'Block not found.') };
    }
    if (arrival !== null && departure !== null && arrival > departure) {
      return {
        ok: false,
        error: validationError('ARRIVAL_AFTER_DEPARTURE', 'Arrival must not be after departure.'),
      };
    }

    const existing = state.daySettings.find((d) => d.date === date);
    const others = state.daySettings.filter((d) => d.date !== date);
    const setting: DaySetting = {
      tripId: state.trip.id,
      date,
      arrivalBlockId,
      departureBlockId,
      locationName: existing?.locationName ?? null,
      locationLat: existing?.locationLat ?? null,
      locationLon: existing?.locationLon ?? null,
      locationTz: existing?.locationTz ?? null,
      updatedAt: '',
    };
    if (arrivalBlockId === null && departureBlockId === null && locationOf(setting) === null) {
      return commit(state, { ...state, daySettings: others });
    }
    return commit(state, { ...state, daySettings: [...others, setting] });
  };
}

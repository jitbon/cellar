import { validationError } from '../model/errors';
import type { DaySetting, ISODate, Location } from '../model/types';
import { validateLocation } from '../model/validation';
import { locationFields, locationOf, tripLocation } from '../queries/location';
import { locationKey } from '../weather/status';
import type { Command } from './command';
import { commit } from './diff';

const keyOf = (l: Location | null) => (l ? locationKey(l) : null);

/**
 * Sets (or, with null, clears) the trip location. A different location drops the chosen cover
 * photo, since it belonged to the old city.
 */
export function setTripLocation(location: Location | null): Command {
  return (state) => {
    const error = location ? validateLocation(location) : null;
    if (error) return { ok: false, error };
    const moved = keyOf(location) !== keyOf(tripLocation(state));
    // Chosen photos belong to the old city, so a new location clears both.
    const coverPhoto = moved ? null : state.trip.coverPhoto;
    const bannerPhoto = moved ? null : state.trip.bannerPhoto;
    return commit(state, {
      ...state,
      trip: { ...state.trip, ...locationFields(location), coverPhoto, bannerPhoto },
    });
  };
}

/** Sets (or, with null, clears) a day's location override; the day_settings row follows its lifecycle. */
export function setDayLocation(date: ISODate, location: Location | null): Command {
  return (state) => {
    if (date < state.trip.startDate || date > state.trip.endDate) {
      return {
        ok: false,
        error: validationError('DATE_OUT_OF_RANGE', 'That date is outside the trip.'),
      };
    }
    const error = location ? validateLocation(location) : null;
    if (error) return { ok: false, error };

    const existing = state.daySettings.find((d) => d.date === date);
    const others = state.daySettings.filter((d) => d.date !== date);
    const setting: DaySetting = {
      tripId: state.trip.id,
      date,
      arrivalBlockId: existing?.arrivalBlockId ?? null,
      departureBlockId: existing?.departureBlockId ?? null,
      ...locationFields(location),
      updatedAt: '',
    };
    const keep =
      setting.arrivalBlockId !== null ||
      setting.departureBlockId !== null ||
      locationOf(setting) !== null;
    return commit(state, { ...state, daySettings: keep ? [...others, setting] : others });
  };
}

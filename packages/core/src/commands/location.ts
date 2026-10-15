import type { Location } from '../model/types';
import { validateLocation } from '../model/validation';
import { locationFields } from '../queries/location';
import type { Command } from './command';
import { commit } from './diff';

/** Sets (or, with null, clears) the trip location. */
export function setTripLocation(location: Location | null): Command {
  return (state) => {
    const error = location ? validateLocation(location) : null;
    if (error) return { ok: false, error };
    return commit(state, { ...state, trip: { ...state.trip, ...locationFields(location) } });
  };
}

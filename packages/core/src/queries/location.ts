import type { ISODate, Location, LocationFields, TripState } from '../model/types';

export function locationOf(fields: LocationFields | undefined): Location | null {
  if (
    !fields ||
    fields.locationName === null ||
    fields.locationLat === null ||
    fields.locationLon === null ||
    fields.locationTz === null
  ) {
    return null;
  }
  return {
    name: fields.locationName,
    lat: fields.locationLat,
    lon: fields.locationLon,
    tz: fields.locationTz,
  };
}

export function locationFields(location: Location | null): LocationFields {
  return {
    locationName: location ? location.name.trim() : null,
    locationLat: location ? location.lat : null,
    locationLon: location ? location.lon : null,
    locationTz: location ? location.tz : null,
  };
}

export const tripLocation = (state: TripState): Location | null => locationOf(state.trip);

/** Where to bias place search: the day's location for a date, else the trip's, else nowhere. */
export function suggestNear(state: TripState, date?: ISODate): { lat: number; lon: number } | null {
  const location = date ? dayLocation(state, date) : tripLocation(state);
  return location ? { lat: location.lat, lon: location.lon } : null;
}

/** The location set for this day only (the pin badge), or null. */
export function dayLocationOverride(state: TripState, date: ISODate): Location | null {
  return locationOf(state.daySettings.find((d) => d.date === date));
}

/** Effective location for a day: its override, else the trip location. */
export const dayLocation = (state: TripState, date: ISODate): Location | null =>
  dayLocationOverride(state, date) ?? tripLocation(state);

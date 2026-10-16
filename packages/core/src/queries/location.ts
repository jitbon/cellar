import type { ISODate, Location, LocationFields, TripState } from '../model/types';
import { locationKey } from '../weather/status';

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

/** The trip location, then each distinct day-override location in date order (no repeats). */
export function tripCities(state: TripState): Location[] {
  const first = tripLocation(state);
  if (!first) return [];
  const found = new Map<string, Location>([[locationKey(first), first]]);
  const overrides = [...state.daySettings].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const setting of overrides) {
    const location = locationOf(setting);
    if (location && !found.has(locationKey(location))) found.set(locationKey(location), location);
  }
  return [...found.values()];
}

// Words that describe the trip rather than the place ("Summer vacation in Rome").
const TRIP_WORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'to',
  'at',
  'of',
  'our',
  'my',
  'and',
  'trip',
  'vacation',
  'holiday',
  'holidays',
  'getaway',
  'weekend',
  'honeymoon',
  'break',
  'spring',
  'summer',
  'fall',
  'autumn',
  'winter',
  'family',
  'road',
  'visit',
  'tour',
]);

/** Best-guess place search text from a trip title, or '' when nothing place-like is left. */
export function placeQueryFromTitle(title: string): string {
  return title
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w !== '' && !TRIP_WORDS.has(w.toLowerCase()))
    .join(' ');
}

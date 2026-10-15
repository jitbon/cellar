import type { DayForecastStatus, ISODate, Location, TripState } from '../model/types';
import { formatISODate, parseISODate } from '../model/validation';
import { days } from '../queries/days';
import { dayLocation } from '../queries/location';

const DAY_MS = 86_400_000;
const FORECAST_DAYS = 16;

/** Calendar date right now in the given IANA time zone. */
export function todayIn(tz: string, now: Date): ISODate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `today` must be the current date in the day's location time zone. */
export function dayForecastStatus(
  state: TripState,
  date: ISODate,
  today: ISODate,
): DayForecastStatus {
  const location = dayLocation(state, date);
  if (!location) return { kind: 'no-location' };
  if (date < today) return { kind: 'past' };
  const lastDay = formatISODate(parseISODate(today) + (FORECAST_DAYS - 1) * DAY_MS);
  if (date > lastDay) {
    return {
      kind: 'pending',
      availableFrom: formatISODate(parseISODate(date) - (FORECAST_DAYS - 1) * DAY_MS),
    };
  }
  return { kind: 'in-range', location };
}

/** Same rounding as the cache key: about 1 km. */
export const locationKey = (l: Location): string =>
  `${l.lat.toFixed(2)},${l.lon.toFixed(2)},${l.tz}`;

/** Distinct locations that have at least one in-range day, i.e. what needs fetching. */
export function forecastLocations(state: TripState, today: (tz: string) => ISODate): Location[] {
  const found = new Map<string, Location>();
  for (const { date } of days(state.trip)) {
    const location = dayLocation(state, date);
    if (!location) continue;
    const status = dayForecastStatus(state, date, today(location.tz));
    if (status.kind === 'in-range' && !found.has(locationKey(location))) {
      found.set(locationKey(location), location);
    }
  }
  return [...found.values()];
}

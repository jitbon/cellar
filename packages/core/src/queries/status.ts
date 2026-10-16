import type { ISODate, Trip, TripState, TripStatus } from '../model/types';
import { daysBetween } from '../model/validation';
import { todayIn } from '../weather/status';
import { locationOf } from './location';

/** Today's date in the trip location's time zone, else the device's. */
export function tripToday(source: Pick<TripState, 'trip'>, now: Date): ISODate {
  const tz = locationOf(source.trip)?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return todayIn(tz, now);
}

/** Where `today` falls against the trip: days until it starts, day N of M, or over. */
export function tripStatus(trip: Pick<Trip, 'startDate' | 'endDate'>, today: ISODate): TripStatus {
  if (today < trip.startDate) return { kind: 'before', days: daysBetween(today, trip.startDate) };
  if (today > trip.endDate) return { kind: 'after' };
  return {
    kind: 'during',
    day: daysBetween(trip.startDate, today) + 1,
    of: daysBetween(trip.startDate, trip.endDate) + 1,
  };
}

/** "In 12 days", "Day 2 of 5" or "Ended": text, so status never relies on color alone. */
export function tripStatusLabel(status: TripStatus): string {
  switch (status.kind) {
    case 'before':
      return `In ${status.days} ${status.days === 1 ? 'day' : 'days'}`;
    case 'during':
      return `Day ${status.day} of ${status.of}`;
    case 'after':
      return 'Ended';
  }
}

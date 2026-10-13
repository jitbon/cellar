import type { ISODate, Trip } from '../model/types';
import { daysBetween, formatISODate, parseISODate } from '../model/validation';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function days(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
): { date: ISODate; weekday: string }[] {
  const count = daysBetween(trip.startDate, trip.endDate) + 1;
  const start = parseISODate(trip.startDate);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => {
    const ms = start + i * 86_400_000;
    return { date: formatISODate(ms), weekday: WEEKDAYS[new Date(ms).getUTCDay()] };
  });
}

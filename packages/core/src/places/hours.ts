import type { HoursLine, OpeningHours, PlaceInfo } from '../model/types';

const DAY_MIN = 1440;
const MINUTE_MS = 60_000;
// Provider weekdays are Sunday = 0; the week list starts on Monday.
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** The weekday (Sunday = 0) it is at the place; the traveler's own day when the offset is unknown. */
function localDay(now: Date, utcOffsetMinutes: number | null): number {
  if (utcOffsetMinutes === null) return now.getDay();
  return new Date(now.getTime() + utcOffsetMinutes * MINUTE_MS).getUTCDay();
}

/**
 * Today's opening hours and the week's, in the place's local time; null when the provider has
 * no hours. A period that closes after midnight stays on the day it opens (e.g. 18:00–02:00).
 */
export function openingHours(
  info: Pick<PlaceInfo, 'hours' | 'utcOffsetMinutes'>,
  now: Date,
): OpeningHours | null {
  if (!info.hours) return null;
  const { periods } = info.hours;

  const lines: HoursLine[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    kind: 'closed',
    ranges: [],
  }));

  // A lone period that opens Sunday 00:00 and never closes means open around the clock.
  const only = periods[0];
  const always =
    periods.length === 1 &&
    only.close === null &&
    only.open.day === 0 &&
    only.open.hour === 0 &&
    only.open.minute === 0;
  if (always) {
    for (const line of lines) line.kind = 'open-24h';
  } else {
    for (const { open, close } of periods) {
      if (!close) continue;
      const openMin = open.hour * 60 + open.minute;
      let closeMin = close.hour * 60 + close.minute;
      if (close.day !== open.day) closeMin += DAY_MIN;
      lines[open.day].ranges.push({ openMin, closeMin });
    }
    for (const line of lines) {
      line.ranges.sort((a, b) => a.openMin - b.openMin);
      if (line.ranges.length === 0) continue;
      const [first] = line.ranges;
      line.kind =
        line.ranges.length === 1 && first.openMin === 0 && first.closeMin >= DAY_MIN
          ? 'open-24h'
          : 'open';
    }
  }

  return {
    today: lines[localDay(now, info.utcOffsetMinutes)],
    week: MONDAY_FIRST.map((d) => lines[d]),
  };
}

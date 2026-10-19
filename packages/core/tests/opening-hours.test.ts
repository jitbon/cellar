import { describe, expect, it } from 'vitest';
import type { DayTime, WeeklyHours } from '../src/model/types';
import { openingHours } from '../src/places/hours';

const t = (day: number, hour: number, minute = 0): DayTime => ({ day, hour, minute });
const period = (open: DayTime, close: DayTime | null) => ({ open, close });

/** The same hours every day of the week. */
const daily = (oh: number, om: number, ch: number, cm: number): WeeklyHours => ({
  periods: [0, 1, 2, 3, 4, 5, 6].map((d) => period(t(d, oh, om), t(d, ch, cm))),
});

// Friday 2027-04-02, 16:00 UTC.
const now = new Date('2027-04-02T16:00:00Z');

describe('openingHours', () => {
  it('reads one daily range', () => {
    const r = openingHours({ hours: daily(9, 0, 21, 0), utcOffsetMinutes: 0 }, now);
    expect(r?.today).toMatchObject({ kind: 'open', ranges: [{ openMin: 540, closeMin: 1260 }] });
  });

  it('keeps a lunch and a dinner range in order', () => {
    const hours: WeeklyHours = {
      periods: [period(t(5, 18), t(5, 22)), period(t(5, 11, 30), t(5, 14))],
    };
    const r = openingHours({ hours, utcOffsetMinutes: 0 }, now);
    expect(r?.today.ranges).toEqual([
      { openMin: 690, closeMin: 840 },
      { openMin: 1080, closeMin: 1320 },
    ]);
  });

  it('keeps past-midnight closing on the day it opens', () => {
    const hours: WeeklyHours = { periods: [period(t(5, 18), t(6, 2))] };
    const r = openingHours({ hours, utcOffsetMinutes: 0 }, now);
    expect(r?.today.ranges).toEqual([{ openMin: 1080, closeMin: 1560 }]);
    const saturday = r?.week[5];
    expect(saturday?.day).toBe(6);
    expect(saturday?.kind).toBe('closed');
  });

  it('reads a lone Sunday 00:00 period without a close as open 24 hours every day', () => {
    const r = openingHours(
      { hours: { periods: [period(t(0, 0), null)] }, utcOffsetMinutes: 0 },
      now,
    );
    expect(r?.week.every((l) => l.kind === 'open-24h')).toBe(true);
    expect(r?.today.kind).toBe('open-24h');
  });

  it('marks a day with no period closed', () => {
    const hours: WeeklyHours = { periods: [period(t(1, 9), t(1, 17))] };
    const r = openingHours({ hours, utcOffsetMinutes: 0 }, now);
    expect(r?.today).toMatchObject({ day: 5, kind: 'closed', ranges: [] });
  });

  it('is null without hours', () => {
    expect(openingHours({ hours: null, utcOffsetMinutes: 0 }, now)).toBeNull();
  });

  it("follows the place's own day: Tokyo is already Saturday, New York still Friday", () => {
    const hours = daily(9, 0, 17, 0);
    expect(openingHours({ hours, utcOffsetMinutes: 540 }, now)?.today.day).toBe(6);
    expect(openingHours({ hours, utcOffsetMinutes: -300 }, now)?.today.day).toBe(5);
  });

  it("falls back to the runtime's local day without an offset", () => {
    const r = openingHours({ hours: daily(9, 0, 17, 0), utcOffsetMinutes: null }, now);
    expect(r?.today.day).toBe(now.getDay());
  });

  it('lists seven lines, Monday first', () => {
    const r = openingHours({ hours: daily(9, 0, 17, 0), utcOffsetMinutes: 0 }, now);
    expect(r?.week.map((l) => l.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Forecast, ForecastHour } from '../src/model/types';
import { summarizeWindow } from '../src/weather/summarize';

const pad = (n: number) => String(n).padStart(2, '0');

function make(
  day: string,
  fn: (hour: number) => Partial<Omit<ForecastHour, 'time'>>,
  days = 2,
): Forecast {
  const hours: ForecastHour[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.parse(day) + d * 86_400_000).toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) {
      hours.push({
        time: `${date}T${pad(h)}:00`,
        code: 0,
        tempC: 20,
        rainPct: 0,
        ...fn(d * 24 + h),
      });
    }
  }
  return { tz: 'Asia/Tokyo', hours, fetchedAt: '2027-04-01T00:00:00.000Z' };
}

const win = (startH: number, endH: number) => ({ startMin: startH * 60, endMin: endH * 60 });

describe('summarizeWindow', () => {
  it('uses the hours in [start, end)', () => {
    const f = make('2027-04-01', (i) => ({ code: i === 14 ? 61 : 0 }));
    expect(summarizeWindow(f, '2027-04-01', win(12, 14))?.condition).toBe('clear');
    expect(summarizeWindow(f, '2027-04-01', win(12, 15))?.condition).toBe('rain');
  });

  it('picks the most severe condition', () => {
    const codes = [
      [0, 'clear'],
      [2, 'partly-cloudy'],
      [3, 'cloudy'],
      [45, 'fog'],
      [61, 'rain'],
      [71, 'snow'],
      [95, 'thunderstorm'],
    ] as const;
    for (const [code, expected] of codes) {
      const f = make('2027-04-01', (i) => ({ code: i === 9 ? code : 0 }));
      expect(summarizeWindow(f, '2027-04-01', win(8, 10))?.condition).toBe(expected);
    }
    const mixed = make('2027-04-01', (i) => ({ code: i === 8 ? 95 : i === 9 ? 71 : 0 }));
    expect(summarizeWindow(mixed, '2027-04-01', win(8, 10))?.condition).toBe('thunderstorm');
    const rainSnow = make('2027-04-01', (i) => ({ code: i === 8 ? 61 : i === 9 ? 71 : 0 }));
    expect(summarizeWindow(rainSnow, '2027-04-01', win(8, 10))?.condition).toBe('snow');
  });

  it('takes the maximum rain chance, null only when all are null', () => {
    const f = make('2027-04-01', (i) => ({ rainPct: i === 8 ? 30 : i === 9 ? 80 : null }));
    expect(summarizeWindow(f, '2027-04-01', win(8, 10))?.rainPct).toBe(80);
    expect(summarizeWindow(f, '2027-04-01', win(12, 14))?.rainPct).toBeNull();
  });

  it('rounds the mean temperature', () => {
    const f = make('2027-04-01', (i) => ({ tempC: i === 8 ? 10 : 11 }));
    expect(summarizeWindow(f, '2027-04-01', win(8, 10))?.tempC).toBe(11); // 10.5 -> 11
    expect(summarizeWindow(f, '2027-04-01', win(8, 9))?.tempC).toBe(10);
  });

  it('continues into the next date when the window crosses midnight', () => {
    const f = make('2027-04-01', (i) => ({ code: i === 24 + 1 ? 71 : 0 }));
    expect(summarizeWindow(f, '2027-04-01', win(23, 2))?.condition).toBe('snow');
    const g = make('2027-04-01', (i) => ({ code: i === 24 + 2 ? 71 : 0 }));
    expect(summarizeWindow(g, '2027-04-01', win(23, 2))?.condition).toBe('clear');
  });

  it('uses the starting hour for a window shorter than an hour', () => {
    const f = make('2027-04-01', (i) => ({ code: i === 20 ? 61 : 0 }));
    const w = { startMin: 20 * 60 + 30, endMin: 21 * 60 };
    expect(summarizeWindow(f, '2027-04-01', w)?.condition).toBe('rain');
  });

  it('returns null when none of the hours are in the data', () => {
    const f = make('2027-04-01', () => ({}), 1);
    expect(summarizeWindow(f, '2027-04-05', win(8, 10))).toBeNull();
  });

  it('uses only the available hours at the end of the data', () => {
    const f = make('2027-04-01', () => ({}), 1);
    expect(summarizeWindow(f, '2027-04-01', win(23, 2))?.condition).toBe('clear');
  });

  it('copies fetchedAt from the forecast', () => {
    const f = make('2027-04-01', () => ({}));
    expect(summarizeWindow(f, '2027-04-01', win(8, 10))?.fetchedAt).toBe(f.fetchedAt);
  });
});

describe('summarizeWindow night', () => {
  it('is night when most of the window is after dark', () => {
    // Dark before 06:00 and from 18:00.
    const f = make('2027-04-01', (i) => ({ isDay: i % 24 >= 6 && i % 24 < 18 }));
    expect(summarizeWindow(f, '2027-04-01', win(20, 23))?.night).toBe(true);
    expect(summarizeWindow(f, '2027-04-01', win(12, 14))?.night).toBe(false);
    // 17:00-19:00: one light hour, one dark hour; not "most", so day.
    expect(summarizeWindow(f, '2027-04-01', win(17, 19))?.night).toBe(false);
    // Crossing midnight counts the hours after it too.
    expect(summarizeWindow(f, '2027-04-01', win(22, 2))?.night).toBe(true);
  });

  it('is day when the forecast has no day/night data', () => {
    const f = make('2027-04-01', () => ({}));
    expect(summarizeWindow(f, '2027-04-01', win(20, 23))?.night).toBe(false);
  });
});

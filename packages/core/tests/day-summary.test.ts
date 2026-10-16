import { describe, expect, it } from 'vitest';
import type { Forecast, ForecastHour } from '../src/model/types';
import { summarizeDay } from '../src/weather/daySummary';

const DATE = '2027-04-02';
const CLEAR = 0;
const PARTLY = 2;
const CLOUDY = 3;
const FOG = 45;
const RAIN = 61;
const SHOWER = 80;
const SNOW = 71;
const STORM = 95;

type Spec = { code: number; rainPct?: number | null; tempC?: number };

const pad = (n: number) => String(n).padStart(2, '0');

/** A forecast for DATE with one entry per daytime hour 07..21 (15 hours), plus optional extras. */
function forecast(day: Spec[], extra: ForecastHour[] = []): Forecast {
  if (day.length !== 15) throw new Error('need 15 daytime hours');
  const hours = day.map((s, i) => ({
    time: `${DATE}T${pad(7 + i)}:00`,
    code: s.code,
    tempC: s.tempC ?? 20,
    rainPct: s.rainPct === undefined ? 0 : s.rainPct,
  }));
  return { tz: 'Asia/Tokyo', hours: [...extra, ...hours], fetchedAt: '2027-04-02T09:00:00Z' };
}

/** 15 hours of one code, then individual hours (07=index 0 … 21=index 14) overridden. */
function day(base: number, overrides: Record<number, Spec> = {}): Spec[] {
  return Array.from({ length: 15 }, (_, i) => overrides[7 + i] ?? { code: base });
}

const range = (from: number, to: number, spec: Spec): Record<number, Spec> =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, spec]));

const phrase = (f: Forecast) => summarizeDay(f, DATE)?.phrase;

describe('summarizeDay phrases (research R3)', () => {
  const cases: [string, Forecast, string][] = [
    ['clear all day', forecast(day(CLEAR)), 'Sunny all day'],
    ['overcast all day', forecast(day(CLOUDY)), 'Cloudy all day'],
    ['mostly partly cloudy', forecast(day(PARTLY, { 8: { code: CLEAR } })), 'Partly cloudy'],
    ['9 clear + 6 cloudy', forecast(day(CLEAR, range(16, 21, { code: CLOUDY }))), 'Mostly sunny'],
    [
      'rain in the morning',
      forecast(day(CLEAR, range(7, 11, { code: RAIN }))),
      'Rain, clearing PM',
    ],
    [
      'one light shower in the morning',
      forecast(day(CLEAR, { 8: { code: SHOWER } })),
      'Showers, clearing PM',
    ],
    [
      'clear AM, 4 rain hours in the afternoon',
      forecast(day(CLEAR, range(14, 17, { code: RAIN, rainPct: 70 }))),
      'Sunny, PM rain',
    ],
    [
      'cloudy, one likely hour in the afternoon',
      forecast(day(CLOUDY, { 15: { code: CLOUDY, rainPct: 60 } })),
      'Cloudy, PM showers',
    ],
    ['afternoon thunderstorm', forecast(day(CLEAR, { 16: { code: STORM } })), 'Sunny, PM storms'],
    [
      'rain in all three parts',
      forecast(day(CLOUDY, { 8: { code: RAIN }, 13: { code: RAIN }, 19: { code: RAIN } })),
      'Rain all day',
    ],
    ['snow most hours', forecast(day(SNOW, { 20: { code: CLOUDY } })), 'Snow all day'],
    [
      'wet morning and afternoon, dry evening',
      forecast(day(CLOUDY, { ...range(7, 9, { code: RAIN }), ...range(13, 15, { code: RAIN }) })),
      'Rain until evening',
    ],
    [
      'showers morning and evening, dry afternoon',
      forecast(day(CLOUDY, { 8: { code: SHOWER }, 19: { code: SHOWER } })),
      'Showers on and off',
    ],
    [
      'partly cloudy with evening showers (too long, so the base is dropped)',
      forecast(day(PARTLY, { 19: { code: SHOWER } })),
      'Evening showers',
    ],
    [
      'morning fog then clear',
      forecast(day(CLEAR, range(7, 9, { code: FOG }))),
      'Fog early, then sunny',
    ],
    [
      'rain only overnight does not count',
      forecast(day(CLEAR), [
        { time: `${DATE}T03:00`, code: RAIN, tempC: 12, rainPct: 90 },
        { time: `${DATE}T23:00`, code: RAIN, tempC: 12, rainPct: 90 },
      ]),
      'Sunny all day',
    ],
  ];

  for (const [name, f, expected] of cases) {
    it(`${name} → "${expected}"`, () => {
      expect(phrase(f)).toBe(expected);
      expect(expected.length).toBeLessThanOrEqual(24);
    });
  }

  it('counts a 50% chance as wet but not 49%', () => {
    expect(phrase(forecast(day(CLOUDY, { 15: { code: CLOUDY, rainPct: 49 } })))).toBe(
      'Cloudy all day',
    );
    expect(phrase(forecast(day(CLOUDY, { 15: { code: CLOUDY, rainPct: 50 } })))).toBe(
      'Cloudy, PM showers',
    );
  });
});

describe('summarizeDay values', () => {
  it('reports the daytime high, low, highest rain chance and forecast time', () => {
    const f = forecast(
      day(CLEAR, {
        7: { code: CLEAR, tempC: 11.4 },
        14: { code: RAIN, tempC: 24.6, rainPct: 70 },
        15: { code: RAIN, rainPct: 40 },
      }),
      [{ time: `${DATE}T03:00`, code: CLEAR, tempC: 2, rainPct: 95 }],
    );
    const s = summarizeDay(f, DATE)!;
    expect(s.highC).toBe(25);
    expect(s.lowC).toBe(11);
    expect(s.rainPct).toBe(70);
    expect(s.fetchedAt).toBe('2027-04-02T09:00:00Z');
  });

  it('has a null rain chance when no hour reports one', () => {
    const f = forecast(day(CLEAR).map((s) => ({ ...s, rainPct: null })));
    expect(summarizeDay(f, DATE)!.rainPct).toBeNull();
  });

  it('is null with fewer than 8 daytime hours in the forecast', () => {
    const f = forecast(day(CLEAR));
    const partial = { ...f, hours: f.hours.slice(0, 7) };
    expect(summarizeDay(partial, DATE)).toBeNull();
    expect(summarizeDay({ ...f, hours: f.hours.slice(0, 8) }, DATE)).not.toBeNull();
  });

  it('is null for a date the forecast does not cover', () => {
    expect(summarizeDay(forecast(day(CLEAR)), '2027-04-09')).toBeNull();
  });
});

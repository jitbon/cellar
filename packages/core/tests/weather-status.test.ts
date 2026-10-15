import { describe, expect, it } from 'vitest';
import { setTripLocation } from '../src/commands/location';
import type { Location } from '../src/model/types';
import { dayForecastStatus, forecastLocations, todayIn } from '../src/weather/status';
import { expectOk, newTripState, setDayLocationRow } from './fixtures';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
const osaka: Location = { name: 'Osaka, Japan', lat: 34.6937, lon: 135.5022, tz: 'Asia/Tokyo' };

const withKyoto = () =>
  expectOk(setTripLocation(kyoto)(newTripState('2027-04-01', '2027-04-30'))).state;

describe('dayForecastStatus', () => {
  it('is no-location without a trip or day location', () => {
    expect(dayForecastStatus(newTripState(), '2027-04-02', '2027-04-01')).toEqual({
      kind: 'no-location',
    });
  });

  it('is past before today', () => {
    expect(dayForecastStatus(withKyoto(), '2027-04-01', '2027-04-05')).toEqual({ kind: 'past' });
  });

  it('is in-range from today through today + 15', () => {
    const s = withKyoto();
    expect(dayForecastStatus(s, '2027-04-05', '2027-04-05')).toEqual({
      kind: 'in-range',
      location: kyoto,
    });
    expect(dayForecastStatus(s, '2027-04-20', '2027-04-05').kind).toBe('in-range');
  });

  it('is pending after today + 15, with the date the forecast becomes available', () => {
    expect(dayForecastStatus(withKyoto(), '2027-04-21', '2027-04-05')).toEqual({
      kind: 'pending',
      availableFrom: '2027-04-06',
    });
  });

  it('uses the day override location', () => {
    const s = setDayLocationRow(withKyoto(), '2027-04-10', osaka);
    expect(dayForecastStatus(s, '2027-04-10', '2027-04-05')).toEqual({
      kind: 'in-range',
      location: osaka,
    });
  });
});

describe('forecastLocations', () => {
  it('returns distinct in-range locations only', () => {
    let s = withKyoto();
    s = setDayLocationRow(s, '2027-04-10', osaka);
    s = setDayLocationRow(s, '2027-04-11', { ...osaka, lat: 34.6941 }); // same after rounding
    const today = () => '2027-04-05';
    const locs = forecastLocations(s, today);
    expect(locs.map((l) => l.name).sort()).toEqual(['Kyoto, Japan', 'Osaka, Japan']);
  });

  it('skips days that are past or out of range, and trips without a location', () => {
    expect(forecastLocations(newTripState(), () => '2027-04-01')).toEqual([]);
    expect(forecastLocations(withKyoto(), () => '2027-06-01')).toEqual([]);
    expect(forecastLocations(withKyoto(), () => '2027-03-01')).toEqual([]);
  });

  it('asks for today in each location time zone', () => {
    const seen: string[] = [];
    forecastLocations(withKyoto(), (tz) => {
      seen.push(tz);
      return '2027-04-05';
    });
    expect(new Set(seen)).toEqual(new Set(['Asia/Tokyo']));
  });
});

describe('todayIn', () => {
  it('returns the calendar date in the time zone', () => {
    const now = new Date('2027-04-01T20:00:00Z');
    expect(todayIn('Asia/Tokyo', now)).toBe('2027-04-02');
    expect(todayIn('America/Los_Angeles', now)).toBe('2027-04-01');
  });
});

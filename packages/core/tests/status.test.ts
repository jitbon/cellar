import { describe, expect, it } from 'vitest';
import { setTripLocation } from '../src/commands/location';
import type { Location } from '../src/model/types';
import { tripStatus, tripStatusLabel, tripToday } from '../src/queries/status';
import { expectOk, newTripState } from './fixtures';

const trip = { startDate: '2027-04-10', endDate: '2027-04-14' };
const tokyo: Location = { name: 'Tokyo, Japan', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' };
const utc: Location = { name: 'Reykjavik, Iceland', lat: 64.15, lon: -21.94, tz: 'UTC' };

describe('tripStatus', () => {
  it('is before, with the days until the first day', () => {
    expect(tripStatus(trip, '2027-04-09')).toEqual({ kind: 'before', days: 1 });
    expect(tripStatus(trip, '2027-03-29')).toEqual({ kind: 'before', days: 12 });
  });

  it('is during on the first day (day 1), a middle day and the last day', () => {
    expect(tripStatus(trip, '2027-04-10')).toEqual({ kind: 'during', day: 1, of: 5 });
    expect(tripStatus(trip, '2027-04-11')).toEqual({ kind: 'during', day: 2, of: 5 });
    expect(tripStatus(trip, '2027-04-14')).toEqual({ kind: 'during', day: 5, of: 5 });
  });

  it('is after the last day', () => {
    expect(tripStatus(trip, '2027-04-15')).toEqual({ kind: 'after' });
  });
});

describe('tripStatusLabel', () => {
  it('words each status', () => {
    expect(tripStatusLabel({ kind: 'before', days: 1 })).toBe('In 1 day');
    expect(tripStatusLabel({ kind: 'before', days: 12 })).toBe('In 12 days');
    expect(tripStatusLabel({ kind: 'during', day: 2, of: 5 })).toBe('Day 2 of 5');
    expect(tripStatusLabel({ kind: 'after' })).toBe('Ended');
  });
});

describe('tripToday', () => {
  // 16:00 UTC on Apr 1 is already 01:00 on Apr 2 in Tokyo.
  const now = new Date('2027-04-01T16:00:00Z');

  it("uses the trip location's time zone", () => {
    const inTokyo = expectOk(setTripLocation(tokyo)(newTripState())).state;
    const inUtc = expectOk(setTripLocation(utc)(newTripState())).state;
    expect(tripToday(inTokyo, now)).toBe('2027-04-02');
    expect(tripToday(inUtc, now)).toBe('2027-04-01');
  });

  it("uses the device's time zone without a location", () => {
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(tripToday(newTripState(), now)).toBe(local);
  });
});

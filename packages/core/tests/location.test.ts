import { describe, expect, it } from 'vitest';
import { setTripLocation } from '../src/commands/location';
import { History } from '../src/history';
import type { DaySetting, Location } from '../src/model/types';
import {
  dayLocation,
  dayLocationOverride,
  tripCities,
  tripLocation,
} from '../src/queries/location';
import { expectOk, newTripState, setDayLocationRow } from './fixtures';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
const osaka: Location = { name: 'Osaka, Japan', lat: 34.6937, lon: 135.5022, tz: 'Asia/Tokyo' };

describe('setTripLocation', () => {
  it('sets the four fields and emits one trips upsert', () => {
    const s = newTripState();
    const r = expectOk(setTripLocation(kyoto)(s));
    expect(r.state.trip).toMatchObject({
      locationName: 'Kyoto, Japan',
      locationLat: 35.0211,
      locationLon: 135.7538,
      locationTz: 'Asia/Tokyo',
    });
    expect(r.changes).toEqual([expect.objectContaining({ table: 'trips', op: 'upsert' })]);
  });

  it('clears the location with null', () => {
    const s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    const r = expectOk(setTripLocation(null)(s));
    expect(r.state.trip).toMatchObject({
      locationName: null,
      locationLat: null,
      locationLon: null,
      locationTz: null,
    });
  });

  it('rejects an invalid location', () => {
    const s = newTripState();
    const empty = setTripLocation({ ...kyoto, name: '  ' })(s);
    const far = setTripLocation({ ...kyoto, lat: 100 })(s);
    expect(!empty.ok && empty.error.code).toBe('INVALID_LOCATION');
    expect(!far.ok && far.error.code).toBe('INVALID_LOCATION');
  });

  it('undo restores the previous location', () => {
    const h = new History(newTripState());
    h.apply(setTripLocation(kyoto));
    h.apply(setTripLocation(osaka));
    h.undo();
    expect(tripLocation(h.state)).toEqual(kyoto);
    h.undo();
    expect(tripLocation(h.state)).toBeNull();
  });
});

describe('location queries', () => {
  const override: DaySetting = {
    tripId: 't',
    date: '2027-04-02',
    arrivalBlockId: null,
    departureBlockId: null,
    locationName: osaka.name,
    locationLat: osaka.lat,
    locationLon: osaka.lon,
    locationTz: osaka.tz,
    updatedAt: '',
  };

  it('tripLocation returns a Location or null', () => {
    const s = newTripState();
    expect(tripLocation(s)).toBeNull();
    expect(tripLocation(expectOk(setTripLocation(kyoto)(s)).state)).toEqual(kyoto);
  });

  it('dayLocation prefers the day override over the trip location', () => {
    const s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    const withOverride = { ...s, daySettings: [override] };
    expect(dayLocation(withOverride, '2027-04-02')).toEqual(osaka);
    expect(dayLocation(withOverride, '2027-04-03')).toEqual(kyoto);
  });

  it('dayLocationOverride returns only the override', () => {
    const s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    const withOverride = { ...s, daySettings: [override] };
    expect(dayLocationOverride(withOverride, '2027-04-02')).toEqual(osaka);
    expect(dayLocationOverride(withOverride, '2027-04-03')).toBeNull();
  });
});

describe('tripCities', () => {
  const tokyo: Location = { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' };

  it('is empty without a trip location', () => {
    expect(tripCities(newTripState())).toEqual([]);
  });

  it('is just the trip location without overrides', () => {
    const s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    expect(tripCities(s)).toEqual([kyoto]);
  });

  it('lists the trip first, then distinct overrides in date order', () => {
    let s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    s = setDayLocationRow(s, '2027-04-04', tokyo);
    s = setDayLocationRow(s, '2027-04-02', osaka);
    expect(tripCities(s)).toEqual([kyoto, osaka, tokyo]);
  });

  it('drops duplicate overrides and overrides equal to the trip location', () => {
    let s = expectOk(setTripLocation(kyoto)(newTripState())).state;
    s = setDayLocationRow(s, '2027-04-01', kyoto);
    s = setDayLocationRow(s, '2027-04-02', osaka);
    s = setDayLocationRow(s, '2027-04-03', { ...osaka, name: 'Osaka' });
    expect(tripCities(s)).toEqual([kyoto, osaka]);
  });
});

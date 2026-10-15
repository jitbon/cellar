import { describe, expect, it } from 'vitest';
import { removeBlock } from '../src/commands/block';
import { setDayWindow } from '../src/commands/daySetting';
import { setDayLocation, setTripLocation } from '../src/commands/location';
import { History } from '../src/history';
import type { Location } from '../src/model/types';
import { dayLocation, dayLocationOverride, suggestNear } from '../src/queries/location';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
const osaka: Location = { name: 'Osaka, Japan', lat: 34.6937, lon: 135.5022, tz: 'Asia/Tokyo' };
const DATE = '2027-04-02';

describe('suggestNear', () => {
  it('uses the day override, else the trip location, else null', () => {
    const none = newTripState();
    expect(suggestNear(none)).toBeNull();
    expect(suggestNear(none, DATE)).toBeNull();

    const withTrip = expectOk(setTripLocation(kyoto)(none)).state;
    expect(suggestNear(withTrip)).toEqual({ lat: kyoto.lat, lon: kyoto.lon });
    expect(suggestNear(withTrip, DATE)).toEqual({ lat: kyoto.lat, lon: kyoto.lon });

    const withDay = expectOk(setDayLocation(DATE, osaka)(withTrip)).state;
    expect(suggestNear(withDay, DATE)).toEqual({ lat: osaka.lat, lon: osaka.lon });
    expect(suggestNear(withDay, '2027-04-03')).toEqual({ lat: kyoto.lat, lon: kyoto.lon });
    expect(suggestNear(withDay)).toEqual({ lat: kyoto.lat, lon: kyoto.lon });
  });
});

describe('setDayLocation', () => {
  it('creates a day_settings row with null arrival/departure and the location', () => {
    const r = expectOk(setDayLocation(DATE, osaka)(newTripState()));
    expect(r.state.daySettings).toHaveLength(1);
    expect(r.state.daySettings[0]).toMatchObject({
      date: DATE,
      arrivalBlockId: null,
      departureBlockId: null,
      locationName: 'Osaka, Japan',
      locationLat: 34.6937,
      locationLon: 135.5022,
      locationTz: 'Asia/Tokyo',
    });
    expect(r.changes).toEqual([expect.objectContaining({ table: 'day_settings', op: 'upsert' })]);
  });

  it('deletes the row when clearing and arrival/departure are null', () => {
    const s = expectOk(setDayLocation(DATE, osaka)(newTripState())).state;
    const r = expectOk(setDayLocation(DATE, null)(s));
    expect(r.state.daySettings).toEqual([]);
    expect(r.changes).toEqual([expect.objectContaining({ table: 'day_settings', op: 'delete' })]);
  });

  it('keeps the row, with the location cleared, when arrival or departure is set', () => {
    const base = newTripState();
    const lunch = blockIdByName(base, 'Lunch');
    let s = expectOk(setDayWindow(DATE, lunch, null)(base)).state;
    s = expectOk(setDayLocation(DATE, osaka)(s)).state;
    const r = expectOk(setDayLocation(DATE, null)(s));
    expect(r.state.daySettings).toHaveLength(1);
    expect(r.state.daySettings[0]).toMatchObject({
      arrivalBlockId: lunch,
      locationName: null,
      locationLat: null,
      locationLon: null,
      locationTz: null,
    });
  });

  it('clearing a day that has no row is a no-op', () => {
    const r = expectOk(setDayLocation(DATE, null)(newTripState()));
    expect(r.changes).toEqual([]);
  });

  it('rejects a date outside the trip and an invalid location', () => {
    const s = newTripState();
    const a = setDayLocation('2030-01-01', osaka)(s);
    const b = setDayLocation(DATE, { ...osaka, lon: -181 })(s);
    expect(!a.ok && a.error.code).toBe('DATE_OUT_OF_RANGE');
    expect(!b.ok && b.error.code).toBe('INVALID_LOCATION');
  });

  it('setTripLocation does not change day overrides', () => {
    let s = expectOk(setDayLocation(DATE, osaka)(newTripState())).state;
    s = expectOk(setTripLocation(kyoto)(s)).state;
    expect(dayLocationOverride(s, DATE)).toEqual(osaka);
    expect(dayLocation(s, '2027-04-03')).toEqual(kyoto);
  });
});

describe('day_settings row lifecycle with a location override (research R4)', () => {
  it('setDayWindow(date, null, null) keeps the row and its location', () => {
    const base = newTripState();
    const lunch = blockIdByName(base, 'Lunch');
    let s = expectOk(setDayWindow(DATE, lunch, null)(base)).state;
    s = expectOk(setDayLocation(DATE, osaka)(s)).state;
    const r = expectOk(setDayWindow(DATE, null, null)(s));
    expect(r.state.daySettings).toHaveLength(1);
    expect(dayLocationOverride(r.state, DATE)).toEqual(osaka);
    expect(r.state.daySettings[0].arrivalBlockId).toBeNull();
  });

  it('setDayWindow(date, a, d) preserves an existing override', () => {
    const base = newTripState();
    const s = expectOk(setDayLocation(DATE, osaka)(base)).state;
    const r = expectOk(
      setDayWindow(DATE, blockIdByName(base, 'Lunch'), blockIdByName(base, 'Dinner'))(s),
    );
    expect(dayLocationOverride(r.state, DATE)).toEqual(osaka);
  });

  it('removeBlock of an arrival block keeps a row that has a location override', () => {
    const base = newTripState();
    const lunch = blockIdByName(base, 'Lunch');
    let s = expectOk(setDayLocation(DATE, osaka)(base)).state;
    s = expectOk(setDayWindow(DATE, lunch, null)(s)).state;
    const r = expectOk(removeBlock(lunch)(s));
    expect(r.state.daySettings).toHaveLength(1);
    expect(r.state.daySettings[0].arrivalBlockId).toBeNull();
    expect(dayLocationOverride(r.state, DATE)).toEqual(osaka);
  });
});

describe('undo', () => {
  it('restores each prior state exactly', () => {
    const base = newTripState();
    const h = new History(base);
    const lunch = blockIdByName(base, 'Lunch');
    h.apply(setDayWindow(DATE, lunch, null));
    const afterWindow = h.state.daySettings;
    h.apply(setDayLocation(DATE, osaka));
    h.apply(setDayLocation(DATE, null));
    h.undo();
    expect(dayLocationOverride(h.state, DATE)).toEqual(osaka);
    h.undo();
    expect(h.state.daySettings.map((d) => ({ ...d, updatedAt: '' }))).toEqual(
      afterWindow.map((d) => ({ ...d, updatedAt: '' })),
    );
    h.undo();
    expect(h.state.daySettings).toEqual([]);
  });

  it('undoing a clear that deleted the row recreates it', () => {
    const h = new History(newTripState());
    h.apply(setDayLocation(DATE, osaka));
    h.apply(setDayLocation(DATE, null));
    expect(h.state.daySettings).toEqual([]);
    h.undo();
    expect(dayLocationOverride(h.state, DATE)).toEqual(osaka);
  });
});

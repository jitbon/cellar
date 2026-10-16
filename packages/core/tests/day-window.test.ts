import { describe, expect, it } from 'vitest';
import { setDayWindow } from '../src/commands/daySetting';
import { greyedSide, isGreyed } from '../src/queries/greyed';
import { blockIdByName, expectOk, newTripState } from './fixtures';

describe('setDayWindow', () => {
  it('stores arrival and departure for a day', () => {
    const s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    const afternoon = blockIdByName(s, 'Afternoon');
    const r = expectOk(setDayWindow('2027-04-01', lunch, afternoon)(s));
    expect(r.state.daySettings).toHaveLength(1);
    expect(r.state.daySettings[0]).toMatchObject({
      tripId: s.trip.id,
      date: '2027-04-01',
      arrivalBlockId: lunch,
      departureBlockId: afternoon,
    });
    expect(r.changes).toEqual([expect.objectContaining({ table: 'day_settings', op: 'upsert' })]);
  });

  it('rejects arrival after departure', () => {
    const s = newTripState();
    const r = setDayWindow('2027-04-01', blockIdByName(s, 'Dinner'), blockIdByName(s, 'Lunch'))(s);
    expect(!r.ok && r.error.code).toBe('ARRIVAL_AFTER_DEPARTURE');
  });

  it('allows arrival and departure in the same block', () => {
    const s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    expect(setDayWindow('2027-04-01', lunch, lunch)(s).ok).toBe(true);
  });

  it('rejects dates outside the trip and unknown blocks', () => {
    const s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    const a = setDayWindow('2030-01-01', lunch, null)(s);
    const b = setDayWindow('2027-04-01', 'nope', null)(s);
    expect(!a.ok && a.error.code).toBe('DATE_OUT_OF_RANGE');
    expect(!b.ok && b.error.code).toBe('NOT_FOUND');
  });

  it('updates an existing setting in place', () => {
    const s = newTripState();
    const r1 = expectOk(setDayWindow('2027-04-01', blockIdByName(s, 'Lunch'), null)(s));
    const r2 = expectOk(setDayWindow('2027-04-01', blockIdByName(s, 'Dinner'), null)(r1.state));
    expect(r2.state.daySettings).toHaveLength(1);
    expect(r2.state.daySettings[0].arrivalBlockId).toBe(blockIdByName(s, 'Dinner'));
  });

  it('clearing both removes the DaySetting', () => {
    const s = newTripState();
    const r1 = expectOk(setDayWindow('2027-04-01', blockIdByName(s, 'Lunch'), null)(s));
    const r2 = expectOk(setDayWindow('2027-04-01', null, null)(r1.state));
    expect(r2.state.daySettings).toEqual([]);
    expect(r2.changes).toEqual([expect.objectContaining({ table: 'day_settings', op: 'delete' })]);
    const back = expectOk(r2.inverse(r2.state));
    expect(back.state.daySettings).toHaveLength(1);
  });

  it('clearing a day with no setting is a no-op', () => {
    const s = newTripState();
    const r = expectOk(setDayWindow('2027-04-01', null, null)(s));
    expect(r.changes).toEqual([]);
  });
});

describe('isGreyed', () => {
  it('is true only for blocks before arrival or after departure on that day', () => {
    const s0 = newTripState();
    const s = expectOk(
      setDayWindow('2027-04-02', blockIdByName(s0, 'Lunch'), blockIdByName(s0, 'Afternoon'))(s0),
    ).state;
    const grey = (name: string, date = '2027-04-02') => isGreyed(s, date, blockIdByName(s, name));
    expect(grey('Morning')).toBe(true);
    expect(grey('Breakfast')).toBe(true);
    expect(grey('Late morning')).toBe(true);
    expect(grey('Lunch')).toBe(false);
    expect(grey('Afternoon')).toBe(false);
    expect(grey('Dinner')).toBe(true);
    expect(grey('Dessert')).toBe(true);
    expect(grey('Evening')).toBe(true);
    expect(grey('Night')).toBe(true);
    expect(grey('Late afternoon')).toBe(true);
  });

  it('only affects the day that has a setting', () => {
    const s0 = newTripState();
    const s = expectOk(setDayWindow('2027-04-02', blockIdByName(s0, 'Lunch'), null)(s0)).state;
    expect(isGreyed(s, '2027-04-03', blockIdByName(s, 'Morning'))).toBe(false);
    expect(isGreyed(s, '2027-04-02', blockIdByName(s, 'Evening'))).toBe(false); // no departure set
    expect(isGreyed(s, '2027-04-02', blockIdByName(s, 'Morning'))).toBe(true);
  });

  it('departure only greys the blocks after it', () => {
    const s0 = newTripState();
    const s = expectOk(setDayWindow('2027-04-04', null, blockIdByName(s0, 'Afternoon'))(s0)).state;
    expect(isGreyed(s, '2027-04-04', blockIdByName(s, 'Morning'))).toBe(false);
    expect(isGreyed(s, '2027-04-04', blockIdByName(s, 'Dinner'))).toBe(true);
  });
});

describe('greyedSide', () => {
  it('says whether a greyed cell is before arrival or after departure', () => {
    const s0 = newTripState();
    const s = expectOk(
      setDayWindow('2027-04-02', blockIdByName(s0, 'Lunch'), blockIdByName(s0, 'Afternoon'))(s0),
    ).state;
    const side = (name: string, date = '2027-04-02') => greyedSide(s, date, blockIdByName(s, name));
    expect(side('Morning')).toBe('before-arrival');
    expect(side('Late morning')).toBe('before-arrival');
    expect(side('Lunch')).toBeNull();
    expect(side('Afternoon')).toBeNull();
    expect(side('Dinner')).toBe('after-departure');
    expect(side('Night')).toBe('after-departure');
    expect(side('Morning', '2027-04-03')).toBeNull();
  });
});

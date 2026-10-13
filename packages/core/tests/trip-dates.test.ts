import { describe, expect, it } from 'vitest';
import { setDayWindow } from '../src/commands/daySetting';
import { addTypedPlacement } from '../src/commands/placement';
import { updateTripDates } from '../src/commands/trip';
import { expectOk, newTripState } from './fixtures';

function planned() {
  let s = newTripState('2027-04-01', '2027-04-04');
  const b = s.blocks[0].id;
  s = expectOk(addTypedPlacement('2027-04-01', b, 'keep')(s)).state;
  s = expectOk(addTypedPlacement('2027-04-04', b, 'drop1')(s)).state;
  s = expectOk(addTypedPlacement('2027-04-04', b, 'drop2')(s)).state;
  s = expectOk(setDayWindow('2027-04-04', null, s.blocks[2].id)(s)).state;
  s = expectOk(setDayWindow('2027-04-01', s.blocks[1].id, null)(s)).state;
  return s;
}

describe('updateTripDates', () => {
  it('shrinking reports removedPlacementCount and removes placements and DaySettings outside', () => {
    const s = planned();
    const r = expectOk(updateTripDates('2027-04-01', '2027-04-03')(s));
    expect(r.removedPlacementCount).toBe(2);
    expect(r.state.placements.map((p) => p.name)).toEqual(['keep']);
    expect(r.state.daySettings.map((d) => d.date)).toEqual(['2027-04-01']);
    expect(r.state.trip.endDate).toBe('2027-04-03');
    expect(r.changes.filter((c) => c.op === 'delete' && c.table === 'placements')).toHaveLength(2);
    expect(r.changes.filter((c) => c.op === 'delete' && c.table === 'day_settings')).toHaveLength(
      1,
    );
  });

  it('shrinking from the start works too', () => {
    const s = planned();
    const r = expectOk(updateTripDates('2027-04-02', '2027-04-04')(s));
    expect(r.removedPlacementCount).toBe(1);
  });

  it('extending changes no rows other than the trip', () => {
    const s = planned();
    const r = expectOk(updateTripDates('2027-03-30', '2027-04-10')(s));
    expect(r.removedPlacementCount).toBe(0);
    expect(r.changes).toEqual([expect.objectContaining({ table: 'trips', op: 'upsert' })]);
    expect(r.state.placements).toHaveLength(3);
  });

  it('persists the trip upsert before deleting children', () => {
    const r = expectOk(updateTripDates('2027-04-01', '2027-04-03')(planned()));
    expect(r.changes[0]).toMatchObject({ table: 'trips', op: 'upsert' });
  });

  it('validates the range', () => {
    const s = planned();
    const a = updateTripDates('2027-04-05', '2027-04-01')(s);
    const b = updateTripDates('2027-01-01', '2027-03-02')(s);
    expect(!a.ok && a.error.code).toBe('END_BEFORE_START');
    expect(!b.ok && b.error.code).toBe('RANGE_TOO_LONG');
  });

  it('inverse restores the removed placements', () => {
    const s = planned();
    const r = expectOk(updateTripDates('2027-04-01', '2027-04-03')(s));
    const back = expectOk(r.inverse(r.state));
    expect(back.state.placements).toHaveLength(3);
    expect(back.state.trip.endDate).toBe('2027-04-04');
  });
});

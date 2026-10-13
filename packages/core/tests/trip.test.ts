import { describe, expect, it } from 'vitest';
import { createTrip, renameTrip } from '../src/commands/trip';
import { cell } from '../src/queries/cell';
import { expectOk, newTripState } from './fixtures';

describe('createTrip', () => {
  it('creates the 7 default blocks in order', () => {
    const r = expectOk(createTrip('u', 'Tokyo', '2027-04-01', '2027-04-05'));
    const ordered = [...r.state.blocks].sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(ordered.map((b) => b.name)).toEqual([
      'Morning',
      'Breakfast',
      'Post-breakfast',
      'Lunch',
      'Afternoon',
      'Dinner',
      'Evening',
    ]);
    expect(r.state.trip.name).toBe('Tokyo');
    expect(r.state.trip.ownerId).toBe('u');
    expect(r.state.placements).toEqual([]);
  });

  it('emits a trip upsert followed by block upserts', () => {
    const r = expectOk(createTrip('u', 'Tokyo', '2027-04-01', '2027-04-05'));
    expect(r.changes[0].table).toBe('trips');
    expect(r.changes.filter((c) => c.table === 'blocks')).toHaveLength(7);
    expect(r.changes.every((c) => c.op === 'upsert')).toBe(true);
  });

  it('trims the name', () => {
    expect(expectOk(createTrip('u', '  Tokyo ', '2027-04-01', '2027-04-02')).state.trip.name).toBe(
      'Tokyo',
    );
  });

  it('rejects empty name, end before start, and spans over 60 days', () => {
    const bad = (n: string, s: string, e: string) => {
      const r = createTrip('u', n, s, e);
      return r.ok ? null : r.error.code;
    };
    expect(bad('  ', '2027-04-01', '2027-04-02')).toBe('EMPTY_NAME');
    expect(bad('x', '2027-04-05', '2027-04-01')).toBe('END_BEFORE_START');
    expect(bad('x', '2027-01-01', '2027-03-02')).toBe('RANGE_TOO_LONG');
  });
});

describe('renameTrip', () => {
  it('renames, reports the change, and the inverse restores the prior name', () => {
    const state = newTripState();
    const r = expectOk(renameTrip('Kyoto')(state));
    expect(r.state.trip.name).toBe('Kyoto');
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ table: 'trips', op: 'upsert' });
    expect(r.changes[0].row).toMatchObject({ id: state.trip.id, name: 'Kyoto' });

    const back = expectOk(r.inverse(r.state));
    expect(back.state.trip.name).toBe('Tokyo');
    expect(back.state.blocks).toEqual(state.blocks);
  });

  it('validates the name', () => {
    const r = renameTrip(' ')(newTripState());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('EMPTY_NAME');
  });
});

describe('cell fixture sanity', () => {
  it('new trip has empty cells', () => {
    const s = newTripState();
    expect(cell(s, '2027-04-01', s.blocks[0].id)).toEqual([]);
  });
});

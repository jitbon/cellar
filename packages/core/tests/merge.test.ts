import { describe, expect, it } from 'vitest';
import { applyRemote } from '../src/merge';
import type { Change } from '../src/commands/command';
import type { Item, TripState } from '../src/model/types';
import { placeFields } from '../src/places/fields';
import { newTripState } from './fixtures';

const none = new Set<string>();

function withItem(updatedAt = '2027-01-01T00:00:00.000Z'): { state: TripState; item: Item } {
  const s = newTripState();
  const item: Item = {
    id: 'i1',
    tripId: s.trip.id,
    name: 'Old',
    type: 'food',
    notes: null,
    link: null,
    ...placeFields(null),
    updatedAt,
  };
  return { state: { ...s, items: [item] }, item };
}

const upsert = (row: Item): Change => ({ table: 'items', op: 'upsert', row: { ...row } });

describe('applyRemote', () => {
  it('newer updatedAt wins', () => {
    const { state, item } = withItem();
    const next = applyRemote(
      state,
      upsert({ ...item, name: 'New', updatedAt: '2027-01-02T00:00:00.000Z' }),
      none,
    );
    expect(next.items[0].name).toBe('New');
  });

  it('older updatedAt is ignored', () => {
    const { state, item } = withItem('2027-01-02T00:00:00.000Z');
    const next = applyRemote(
      state,
      upsert({ ...item, name: 'Stale', updatedAt: '2027-01-01T00:00:00.000Z' }),
      none,
    );
    expect(next).toBe(state);
  });

  it('adds new rows', () => {
    const { state, item } = withItem();
    const next = applyRemote(state, upsert({ ...item, id: 'i2', name: 'Fresh' }), none);
    expect(next.items.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('a delete carrying only the primary key removes the row', () => {
    const { state } = withItem();
    const next = applyRemote(state, { table: 'items', op: 'delete', row: { id: 'i1' } }, none);
    expect(next.items).toEqual([]);
  });

  it('delete of an unknown key is ignored', () => {
    const { state } = withItem();
    const next = applyRemote(state, { table: 'items', op: 'delete', row: { id: 'zzz' } }, none);
    expect(next).toBe(state);
  });

  it('day_settings are keyed by tripId + date', () => {
    const s = newTripState();
    const ds = {
      tripId: s.trip.id,
      date: '2027-04-01',
      arrivalBlockId: s.blocks[0].id,
      departureBlockId: null,
      updatedAt: '2027-01-01T00:00:00.000Z',
    };
    const added = applyRemote(s, { table: 'day_settings', op: 'upsert', row: ds }, none);
    expect(added.daySettings).toHaveLength(1);
    const removed = applyRemote(
      added,
      { table: 'day_settings', op: 'delete', row: { tripId: s.trip.id, date: '2027-04-01' } },
      none,
    );
    expect(removed.daySettings).toEqual([]);
  });

  it('ignores changes to rows with pending local edits', () => {
    const { state, item } = withItem();
    const pending = new Set(['items:i1']);
    const up = applyRemote(
      state,
      upsert({ ...item, name: 'Remote', updatedAt: '2030-01-01T00:00:00.000Z' }),
      pending,
    );
    expect(up).toBe(state);
    const del = applyRemote(state, { table: 'items', op: 'delete', row: { id: 'i1' } }, pending);
    expect(del).toBe(state);
  });

  it('upserts to the trip row replace trip fields when newer', () => {
    const s = newTripState();
    const next = applyRemote(
      s,
      {
        table: 'trips',
        op: 'upsert',
        row: { ...s.trip, name: 'Renamed', updatedAt: '2999-01-01T00:00:00.000Z' },
      },
      none,
    );
    expect(next.trip.name).toBe('Renamed');
  });
});

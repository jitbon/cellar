import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, seedTrip, uuid, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
let tripId: string;
let blockId: string;

const chelsea = {
  place_id: 'test-chelsea',
  place_provider: 'google',
  place_name: 'Chelsea Market',
  place_address: '75 9th Ave, New York',
  place_lat: 40.7424,
  place_lon: -74.0061,
  place_category: 'market',
};

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  ({ tripId, blockId } = await seedTrip(a));
});

afterAll(async () => {
  await deleteTestUsers([a, b]);
});

// Both tables carry the same columns and constraints; insert a row into each with overrides.
type Table = 'items' | 'placements';
const insertRow = (table: Table, extra: Record<string, unknown>) => {
  const base = { id: uuid(), trip_id: tripId, name: 'Lunch', type: 'food' };
  const row =
    table === 'items'
      ? { ...base, ...extra }
      : { ...base, date: '2027-04-02', block_id: blockId, position: 'a0', ...extra };
  return a.client.from(table).insert(row);
};

describe.each(['items', 'placements'] as const)('place columns on %s', (table) => {
  it('rejects a row with only place_id set', async () => {
    const { error } = await insertRow(table, { place_id: 'test-chelsea' });
    expect(error).not.toBeNull();
  });

  it('rejects out-of-range coordinates', async () => {
    expect((await insertRow(table, { ...chelsea, place_lat: 91 })).error).not.toBeNull();
    expect((await insertRow(table, { ...chelsea, place_lon: -181 })).error).not.toBeNull();
  });

  it('rejects an unknown provider', async () => {
    const { error } = await insertRow(table, { ...chelsea, place_provider: 'apple' });
    expect(error).not.toBeNull();
  });

  it('rejects a place name of 201 characters', async () => {
    const { error } = await insertRow(table, { ...chelsea, place_name: 'x'.repeat(201) });
    expect(error).not.toBeNull();
  });

  it('accepts a plain row', async () => {
    expect((await insertRow(table, {})).error).toBeNull();
  });

  it('accepts a fully linked row, with or without a category', async () => {
    expect((await insertRow(table, chelsea)).error).toBeNull();
    expect((await insertRow(table, { ...chelsea, place_category: null })).error).toBeNull();
  });
});

describe('row-level security on the new columns', () => {
  it('another user cannot read them', async () => {
    const id = uuid();
    const created = await a.client
      .from('items')
      .insert({ id, trip_id: tripId, name: 'Lunch', type: 'food', ...chelsea });
    expect(created.error).toBeNull();
    const read = await b.client.from('items').select('place_name').eq('id', id);
    expect(read.data).toEqual([]);
    const own = await a.client.from('items').select('place_name').eq('id', id);
    expect(own.data).toEqual([{ place_name: 'Chelsea Market' }]);
  });
});

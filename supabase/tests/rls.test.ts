import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, seedTrip, uuid, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
let tripId: string;
let blockId: string;
let placementId: string;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  ({ tripId, blockId } = await seedTrip(a));
  placementId = uuid();
  const { error } = await a.client.from('placements').insert({
    id: placementId,
    trip_id: tripId,
    date: '2027-04-02',
    block_id: blockId,
    position: 'a0',
    name: 'Walk',
  });
  expect(error).toBeNull();
});

afterAll(async () => {
  await deleteTestUsers([a, b]);
});

describe('row-level security', () => {
  it('user B cannot select user A rows', async () => {
    for (const table of ['trips', 'blocks', 'placements'] as const) {
      const { data, error } = await b.client.from(table).select('*');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it('user B cannot insert into user A trip', async () => {
    const t = await b.client.from('trips').insert({
      id: uuid(),
      owner_id: a.id,
      name: 'Hijack',
      start_date: '2027-04-01',
      end_date: '2027-04-02',
    });
    expect(t.error).not.toBeNull();
    const bl = await b.client
      .from('blocks')
      .insert({ id: uuid(), trip_id: tripId, name: 'X', position: 'a1' });
    expect(bl.error).not.toBeNull();
    const it = await b.client.from('items').insert({
      id: uuid(),
      trip_id: tripId,
      name: 'X',
      type: 'food',
    });
    expect(it.error).not.toBeNull();
  });

  it('user B cannot update or delete user A rows', async () => {
    const upd = await b.client.from('trips').update({ name: 'Pwned' }).eq('id', tripId).select();
    expect(upd.data).toEqual([]);
    const updP = await b.client
      .from('placements')
      .update({ name: 'Pwned' })
      .eq('id', placementId)
      .select();
    expect(updP.data).toEqual([]);
    await b.client.from('placements').delete().eq('id', placementId);
    await b.client.from('trips').delete().eq('id', tripId);

    const { data } = await a.client.from('trips').select('name').eq('id', tripId);
    expect(data).toEqual([{ name: 'Tokyo' }]);
    const p = await a.client.from('placements').select('name').eq('id', placementId);
    expect(p.data).toEqual([{ name: 'Walk' }]);
  });
});

describe('integrity rules', () => {
  it('rejects a block_id from a different trip', async () => {
    const other = await seedTrip(a);
    const { error } = await a.client.from('placements').insert({
      id: uuid(),
      trip_id: tripId,
      date: '2027-04-02',
      block_id: other.blockId,
      position: 'a1',
      name: 'Cross',
    });
    expect(error).not.toBeNull();
  });

  it('rejects deleting the last block', async () => {
    const solo = await seedTrip(a);
    const { error } = await a.client.from('blocks').delete().eq('id', solo.blockId);
    expect(error).not.toBeNull();
  });

  it('allows deleting a block when another remains', async () => {
    const trip = await seedTrip(a);
    const extra = uuid();
    await a.client
      .from('blocks')
      .insert({ id: extra, trip_id: trip.tripId, name: 'Lunch', position: 'a1' });
    const { error } = await a.client.from('blocks').delete().eq('id', extra);
    expect(error).toBeNull();
  });

  it('rejects a placement date outside the trip range', async () => {
    const { error } = await a.client.from('placements').insert({
      id: uuid(),
      trip_id: tripId,
      date: '2027-05-01',
      block_id: blockId,
      position: 'a2',
      name: 'Late',
    });
    expect(error).not.toBeNull();
  });

  it('rejects a 61-day trip', async () => {
    const { error } = await a.client.from('trips').insert({
      id: uuid(),
      owner_id: a.id,
      name: 'Long',
      start_date: '2027-01-01',
      end_date: '2027-03-02',
    });
    expect(error).not.toBeNull();
  });

  it('accepts a 60-day trip', async () => {
    const { error } = await a.client.from('trips').insert({
      id: uuid(),
      owner_id: a.id,
      name: 'Long',
      start_date: '2027-01-01',
      end_date: '2027-03-01',
    });
    expect(error).toBeNull();
  });

  it('deleting a whole trip cascades even though it has blocks', async () => {
    const trip = await seedTrip(a);
    const { error } = await a.client.from('trips').delete().eq('id', trip.tripId);
    expect(error).toBeNull();
  });
});

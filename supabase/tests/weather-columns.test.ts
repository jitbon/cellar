import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, seedTrip, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
let tripId: string;
let blockId: string;

const kyoto = {
  location_name: 'Kyoto, Japan',
  location_lat: 35.0211,
  location_lon: 135.7538,
  location_tz: 'Asia/Tokyo',
};

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  ({ tripId, blockId } = await seedTrip(a));
});

afterAll(async () => {
  await deleteTestUsers([a, b]);
});

const setTripLocation = (patch: Record<string, unknown>) =>
  a.client.from('trips').update(patch).eq('id', tripId);
const setWindow = (patch: Record<string, unknown>) =>
  a.client.from('blocks').update(patch).eq('id', blockId);

describe('location columns', () => {
  it('rejects a partial location', async () => {
    const { error } = await setTripLocation({ location_name: 'Kyoto, Japan' });
    expect(error).not.toBeNull();
    const day = await a.client
      .from('day_settings')
      .insert({ trip_id: tripId, date: '2027-04-02', location_name: 'Osaka, Japan' });
    expect(day.error).not.toBeNull();
  });

  it('rejects a name of 121 characters', async () => {
    const { error } = await setTripLocation({ ...kyoto, location_name: 'x'.repeat(121) });
    expect(error).not.toBeNull();
  });

  it('rejects out-of-range coordinates', async () => {
    expect((await setTripLocation({ ...kyoto, location_lat: 91 })).error).not.toBeNull();
    expect((await setTripLocation({ ...kyoto, location_lon: -181 })).error).not.toBeNull();
  });

  it('accepts a valid location on trips and day_settings, and clearing it', async () => {
    expect((await setTripLocation(kyoto)).error).toBeNull();
    const day = await a.client
      .from('day_settings')
      .insert({ trip_id: tripId, date: '2027-04-02', ...kyoto });
    expect(day.error).toBeNull();
    const clear = await setTripLocation({
      location_name: null,
      location_lat: null,
      location_lon: null,
      location_tz: null,
    });
    expect(clear.error).toBeNull();
  });
});

describe('block window columns', () => {
  it('rejects 1440 and start = end', async () => {
    expect((await setWindow({ window_start_min: 0, window_end_min: 1440 })).error).not.toBeNull();
    expect((await setWindow({ window_start_min: 600, window_end_min: 600 })).error).not.toBeNull();
  });

  it('rejects one window column alone', async () => {
    expect((await setWindow({ window_start_min: 600 })).error).not.toBeNull();
  });

  it('accepts a window that crosses midnight', async () => {
    expect((await setWindow({ window_start_min: 1380, window_end_min: 120 })).error).toBeNull();
  });
});

describe('row-level security on the new columns', () => {
  it('another user cannot read or update them', async () => {
    await setTripLocation(kyoto);
    const read = await b.client.from('trips').select('location_name').eq('id', tripId);
    expect(read.data).toEqual([]);
    const update = await b.client
      .from('trips')
      .update({ location_name: 'Hijack' })
      .eq('id', tripId)
      .select();
    expect(update.data).toEqual([]);
    const win = await b.client
      .from('blocks')
      .update({ window_start_min: 1, window_end_min: 2 })
      .eq('id', blockId)
      .select();
    expect(win.data).toEqual([]);
    const { data } = await a.client.from('trips').select('location_name').eq('id', tripId);
    expect(data).toEqual([{ location_name: 'Kyoto, Japan' }]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, seedTrip, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;
let tripId: string;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  ({ tripId } = await seedTrip(a));
});

afterAll(async () => {
  await deleteTestUsers([a, b]);
});

const setCover = (user: TestUser, cover_photo: string | null) =>
  user.client.from('trips').update({ cover_photo }).eq('id', tripId);

describe('trips.cover_photo', () => {
  it('accepts null and a normal file name', async () => {
    expect((await setCover(a, null)).error).toBeNull();
    expect((await setCover(a, 'Kyoto_A.jpg')).error).toBeNull();
    const read = await a.client.from('trips').select('cover_photo').eq('id', tripId);
    expect(read.data).toEqual([{ cover_photo: 'Kyoto_A.jpg' }]);
  });

  it('rejects an empty string and 301 characters, accepts 300', async () => {
    expect((await setCover(a, '')).error).not.toBeNull();
    expect((await setCover(a, 'x'.repeat(301))).error).not.toBeNull();
    expect((await setCover(a, 'x'.repeat(300))).error).toBeNull();
  });

  it('cannot be updated by another user', async () => {
    expect((await setCover(a, 'Kyoto_A.jpg')).error).toBeNull();
    const attempt = await setCover(b, 'Hacked.jpg');
    expect(attempt.error).toBeNull(); // RLS filters the row out instead of failing
    const read = await a.client.from('trips').select('cover_photo').eq('id', tripId);
    expect(read.data).toEqual([{ cover_photo: 'Kyoto_A.jpg' }]);
  });
});

const setBanner = (user: TestUser, banner_photo: string | null) =>
  user.client.from('trips').update({ banner_photo }).eq('id', tripId);

describe('trips.banner_photo', () => {
  it('accepts null and a file name, independently of the cover', async () => {
    expect((await setCover(a, 'Kyoto_A.jpg')).error).toBeNull();
    expect((await setBanner(a, 'Kyoto_C.jpg')).error).toBeNull();
    const read = await a.client.from('trips').select('cover_photo, banner_photo').eq('id', tripId);
    expect(read.data).toEqual([{ cover_photo: 'Kyoto_A.jpg', banner_photo: 'Kyoto_C.jpg' }]);
    expect((await setBanner(a, null)).error).toBeNull();
  });

  it('rejects an empty string and 301 characters', async () => {
    expect((await setBanner(a, '')).error).not.toBeNull();
    expect((await setBanner(a, 'x'.repeat(301))).error).not.toBeNull();
  });
});

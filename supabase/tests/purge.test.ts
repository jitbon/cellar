import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, deleteTestUsers, seedTrip, type TestUser } from './helpers';

// Backdating timestamps and running the purge needs direct DB access (service role cannot call
// the function: execute is revoked from API roles).
const db = new pg.Client({
  connectionString:
    process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

const users: TestUser[] = [];

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.end();
  await deleteTestUsers(users);
});

async function userWithTrip() {
  const u = await createTestUser();
  users.push(u);
  const { tripId, blockId } = await seedTrip(u);
  await u.client.from('placements').insert({
    id: randomUUID(),
    trip_id: tripId,
    date: '2027-04-02',
    block_id: blockId,
    position: 'a0',
    name: 'Walk',
  });
  return { u, tripId };
}

const count = async (table: string, col: string, id: string) =>
  Number((await db.query(`select count(*) from ${table} where ${col} = $1`, [id])).rows[0].count);

describe('purge_expired_deletions', () => {
  it('purges a trip deleted 31 days ago with all child rows, keeps one deleted 29 days ago', async () => {
    const old = await userWithTrip();
    const recent = await userWithTrip();
    await db.query(`update trips set deleted_at = now() - interval '31 days' where id = $1`, [
      old.tripId,
    ]);
    await db.query(`update trips set deleted_at = now() - interval '29 days' where id = $1`, [
      recent.tripId,
    ]);

    await db.query('select purge_expired_deletions()');

    expect(await count('trips', 'id', old.tripId)).toBe(0);
    expect(await count('blocks', 'trip_id', old.tripId)).toBe(0);
    expect(await count('placements', 'trip_id', old.tripId)).toBe(0);
    expect(await count('trips', 'id', recent.tripId)).toBe(1);
    expect(await count('placements', 'trip_id', recent.tripId)).toBe(1);
  });

  it('removes an account whose deletion was requested 31 days ago, with its trips', async () => {
    const expired = await userWithTrip();
    await db.query(
      `update profiles set deletion_requested_at = now() - interval '31 days' where id = $1`,
      [expired.u.id],
    );

    await db.query('select purge_expired_deletions()');

    const { data } = await admin.auth.admin.getUserById(expired.u.id);
    expect(data.user).toBeNull();
    expect(await count('trips', 'owner_id', expired.u.id)).toBe(0);
    expect(await count('profiles', 'id', expired.u.id)).toBe(0);
  });

  it('keeps an account whose deletion was requested 29 days ago', async () => {
    const pending = await userWithTrip();
    await db.query(
      `update profiles set deletion_requested_at = now() - interval '29 days' where id = $1`,
      [pending.u.id],
    );

    await db.query('select purge_expired_deletions()');

    const { data } = await admin.auth.admin.getUserById(pending.u.id);
    expect(data.user).not.toBeNull();
    expect(await count('trips', 'owner_id', pending.u.id)).toBe(1);
  });
});

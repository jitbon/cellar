import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Creates a confirmed user and returns an anon client signed in as them. */
export async function createTestUser(): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`;
  const password = 'password-' + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

export async function deleteTestUsers(users: TestUser[]): Promise<void> {
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}

/** Inserts a trip (with one block) as the given user. Returns ids. */
export async function seedTrip(
  user: TestUser,
  opts: { start?: string; end?: string } = {},
): Promise<{ tripId: string; blockId: string }> {
  const tripId = randomUUID();
  const blockId = randomUUID();
  const trip = await user.client.from('trips').insert({
    id: tripId,
    owner_id: user.id,
    name: 'Tokyo',
    start_date: opts.start ?? '2027-04-01',
    end_date: opts.end ?? '2027-04-05',
  });
  if (trip.error) throw trip.error;
  const block = await user.client
    .from('blocks')
    .insert({ id: blockId, trip_id: tripId, name: 'Morning', position: 'a0' });
  if (block.error) throw block.error;
  return { tripId, blockId };
}

export function uuid(): string {
  return randomUUID();
}

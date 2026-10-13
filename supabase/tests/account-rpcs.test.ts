import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, deleteTestUsers, type TestUser } from './helpers';

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});

afterAll(async () => {
  await deleteTestUsers([a, b]);
});

async function pending(id: string): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('deletion_requested_at')
    .eq('id', id)
    .single();
  expect(error).toBeNull();
  return data!.deletion_requested_at;
}

describe('account deletion RPCs', () => {
  it('cancel returns false when nothing is pending', async () => {
    const { data, error } = await a.client.rpc('cancel_account_deletion');
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('request sets the timestamp; cancel clears it and returns true', async () => {
    expect((await a.client.rpc('request_account_deletion')).error).toBeNull();
    expect(await pending(a.id)).not.toBeNull();
    const { data } = await a.client.rpc('cancel_account_deletion');
    expect(data).toBe(true);
    expect(await pending(a.id)).toBeNull();
    expect((await a.client.rpc('cancel_account_deletion')).data).toBe(false);
  });

  it("one user cannot affect another's profile", async () => {
    await a.client.rpc('request_account_deletion');
    expect(await pending(b.id)).toBeNull();
    await b.client.rpc('cancel_account_deletion');
    expect(await pending(a.id)).not.toBeNull();
    const direct = await b.client
      .from('profiles')
      .update({ deletion_requested_at: null })
      .eq('id', a.id)
      .select();
    expect(direct.data).toEqual([]);
    expect(await pending(a.id)).not.toBeNull();
  });

  it('anonymous callers cannot execute the RPCs', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(
      process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
      process.env.SUPABASE_ANON_KEY ?? '',
    );
    expect((await anon.rpc('request_account_deletion')).error).not.toBeNull();
  });
});

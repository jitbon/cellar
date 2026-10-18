import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseAuthService } from '../src/adapters/supabaseAuthService';

const KEY = 'cellar:providerSignIn';
const config = { url: 'http://auth.test', anonKey: 'anon-key' };
const session = {
  user: { id: 'u1', email: 'ana@example.com', app_metadata: { providers: ['google'] } },
};

function makeClient(opts: { session?: unknown; rpcData?: unknown; rpcError?: unknown } = {}) {
  const signInWithOAuth = vi.fn(async () => ({ error: null as unknown }));
  const signOut = vi.fn(async () => ({ error: null }));
  const getSession = vi.fn(async () => ({ data: { session: opts.session ?? null } }));
  const rpc = vi.fn(async () => ({ data: opts.rpcData ?? false, error: opts.rpcError ?? null }));
  const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
  const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
  const client = {
    auth: { signInWithOAuth, signOut, getSession, resetPasswordForEmail, onAuthStateChange },
    rpc,
  } as unknown as SupabaseClient;
  return { client, signInWithOAuth, signOut, getSession, rpc, resetPasswordForEmail };
}

const pending = (over: object = {}) =>
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      provider: 'google',
      from: '/signin',
      returnTo: '/trips/t1',
      startedAt: Date.now(),
      ...over,
    }),
  );

const callback = (hash: string) => new URL(`http://localhost/auth/callback${hash}`);

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('SupabaseAuthService provider sign-in', () => {
  describe('availableProviders', () => {
    it('returns the providers reported on, in fixed order', async () => {
      const fetchMock = vi.fn(async () =>
        Response.json({ external: { email: true, facebook: true, google: true, apple: false } }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const auth = new SupabaseAuthService(makeClient().client, config);
      expect(await auth.availableProviders()).toEqual(['google', 'facebook']);
      expect(fetchMock).toHaveBeenCalledWith('http://auth.test/auth/v1/settings', {
        headers: { apikey: 'anon-key' },
      });
    });

    it('returns [] when the request fails or the answer is unusable', async () => {
      const auth = new SupabaseAuthService(makeClient().client, config);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Promise.reject(new Error('offline'))),
      );
      expect(await auth.availableProviders()).toEqual([]);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status: 500 })),
      );
      expect(await auth.availableProviders()).toEqual([]);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({})),
      );
      expect(await auth.availableProviders()).toEqual([]);
    });
  });

  describe('startProviderSignIn', () => {
    it('saves the pending record then redirects through the account service', async () => {
      const { client, signInWithOAuth } = makeClient();
      signInWithOAuth.mockImplementation(async () => {
        // The record must exist before the page can leave.
        expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({
          provider: 'apple',
          from: '/signup',
          returnTo: '/trips/t1',
        });
        return { error: null };
      });
      await new SupabaseAuthService(client, config).startProviderSignIn(
        'apple',
        '/signup',
        '/trips/t1',
      );
      expect(typeof JSON.parse(sessionStorage.getItem(KEY)!).startedAt).toBe('number');
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'apple',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    });

    it('rejects and forgets the record when the redirect cannot start', async () => {
      const { client, signInWithOAuth } = makeClient();
      signInWithOAuth.mockResolvedValue({ error: new Error('boom') });
      await expect(
        new SupabaseAuthService(client, config).startProviderSignIn('google', '/signin', '/'),
      ).rejects.toThrow('boom');
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('completeProviderSignIn', () => {
    it('signs in: cancels a pending deletion, clears the record, returns the destination', async () => {
      const { client, rpc } = makeClient({ session, rpcData: true });
      pending();
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback('#access_token=a&refresh_token=b&expires_in=3600&token_type=bearer'),
      );
      expect(outcome).toEqual({
        kind: 'signed-in',
        provider: 'google',
        deletionCancelled: true,
        returnTo: '/trips/t1',
      });
      expect(rpc).toHaveBeenCalledWith('cancel_account_deletion');
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('sends an unsafe saved destination to the trip list', async () => {
      const { client } = makeClient({ session });
      pending({ returnTo: '//evil.example' });
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback('#access_token=a&refresh_token=b'),
      );
      expect(outcome).toMatchObject({ kind: 'signed-in', returnTo: '/' });
    });

    it.each([
      ['#error=access_denied&error_description=denied', 'cancelled'],
      ['?error=server_error&error_code=provider_email_needs_verification', 'email-not-verified'],
      [
        '?error=server_error&error_description=Error+getting+user+email+from+external+provider',
        'no-email',
      ],
      ['#error=server_error', 'error'],
    ])('maps %s to %s without a session', async (suffix, kind) => {
      const { client, rpc } = makeClient();
      pending({ provider: 'facebook', from: '/signup' });
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback(suffix),
      );
      expect(outcome).toEqual({ kind, provider: 'facebook', returnTo: '/signup' });
      expect(rpc).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('fails when there is no pending record and signs out a session the URL created', async () => {
      const { client, signOut } = makeClient({ session });
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback('#access_token=a&refresh_token=b'),
      );
      expect(outcome).toEqual({ kind: 'error', provider: null, returnTo: '/signin' });
      expect(signOut).toHaveBeenCalled();
    });

    it('ignores a record older than ten minutes', async () => {
      const { client, signOut } = makeClient({ session });
      pending({ startedAt: Date.now() - 11 * 60_000 });
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback('#access_token=a&refresh_token=b'),
      );
      expect(outcome).toEqual({ kind: 'error', provider: null, returnTo: '/signin' });
      expect(signOut).toHaveBeenCalled();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('never throws: a failed deletion check signs out and reports an error', async () => {
      const { client, signOut } = makeClient({ session, rpcError: new Error('rpc down') });
      pending();
      const outcome = await new SupabaseAuthService(client, config).completeProviderSignIn(
        callback('#access_token=a&refresh_token=b'),
      );
      expect(outcome).toEqual({ kind: 'error', provider: 'google', returnTo: '/signin' });
      expect(signOut).toHaveBeenCalled();
    });

    it('answers a repeated call for the same URL without running twice', async () => {
      const { client, rpc } = makeClient({ session });
      pending();
      const auth = new SupabaseAuthService(client, config);
      const url = callback('#access_token=a&refresh_token=b');
      const [one, two] = await Promise.all([
        auth.completeProviderSignIn(url),
        auth.completeProviderSignIn(url),
      ]);
      expect(one).toEqual(two);
      expect(one.kind).toBe('signed-in');
      expect(rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('existing behavior', () => {
    it('reads sign-in methods from the account', async () => {
      const { client } = makeClient({
        session: {
          user: { id: 'u1', email: 'a@b.c', app_metadata: { providers: ['google', 'email'] } },
        },
      });
      const auth = new SupabaseAuthService(client, config);
      await auth.ready;
      expect(auth.currentUser()?.methods).toEqual(['email', 'google']);
    });

    it('sends password reset to the same page for a provider-only account', async () => {
      const { client, resetPasswordForEmail } = makeClient({ session });
      const auth = new SupabaseAuthService(client, config);
      await auth.ready;
      expect(auth.currentUser()?.methods).toEqual(['google']);
      await auth.requestPasswordReset('ana@example.com');
      expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });
  });
});

import {
  SIGN_IN_PROVIDERS,
  providerCallbackKind,
  signInMethods,
  type AuthService,
  type AuthUser,
  type ProviderSignInOutcome,
  type SignInProvider,
} from '@cellar/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { safeReturnTo } from '../lib/returnTo';

/** sessionStorage key of the sign-in that is out at a provider (data-model.md). */
const PENDING_KEY = 'cellar:providerSignIn';
/** A pending sign-in older than this is ignored. */
const PENDING_MAX_AGE_MS = 10 * 60_000;
/** How long to wait for the session after the provider sends the person back. */
const SESSION_WAIT_MS = 5000;

type From = '/signin' | '/signup';

interface Pending {
  provider: SignInProvider;
  from: From;
  returnTo: string;
}

/** Where the account service lives, for the one call the client library does not offer. */
export interface AuthConfig {
  url: string;
  anonKey: string;
}

/** Query and fragment of a callback URL as one set of parameters. */
function callbackParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.replace(/^#/, '')).forEach((v, k) => params.set(k, v));
  return params;
}

function hasCallbackParams(url: URL): boolean {
  const p = callbackParams(url);
  return p.has('access_token') || p.has('error') || p.has('error_code');
}

/** The pending sign-in, or null when absent, malformed or stale. Always clears the record. */
function takePending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Record<string, unknown>;
    const fresh = typeof r.startedAt === 'number' && Date.now() - r.startedAt <= PENDING_MAX_AGE_MS;
    const provider = SIGN_IN_PROVIDERS.find((p) => p === r.provider);
    if (!fresh || !provider || (r.from !== '/signin' && r.from !== '/signup')) return null;
    return {
      provider,
      from: r.from,
      returnTo: safeReturnTo(typeof r.returnTo === 'string' ? r.returnTo : null),
    };
  } catch {
    return null;
  }
}

function toUser(user: User | null | undefined): AuthUser | null {
  return user
    ? {
        id: user.id,
        email: user.email ?? '',
        methods: signInMethods(user.app_metadata?.providers),
      }
    : null;
}

export class SupabaseAuthService implements AuthService {
  private user: AuthUser | null = null;
  /** Resolves once the persisted session (if any) has been read. */
  readonly ready: Promise<void>;

  /**
   * The address the page was opened with. The client library removes sign-in tokens from the
   * address once it has read them, which can happen before the callback page looks.
   */
  private readonly openedAt: URL | null;
  /** The callback being finished, so a repeated call (React strict mode) does not run twice. */
  private completing: { href: string; result: Promise<ProviderSignInOutcome> } | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly config: AuthConfig | null = null,
  ) {
    this.openedAt = typeof window === 'undefined' ? null : new URL(window.location.href);
    this.ready = client.auth.getSession().then(({ data }) => {
      this.user = toUser(data.session?.user);
    });
    client.auth.onAuthStateChange((_event, session) => {
      this.user = toUser(session?.user);
    });
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<{ deletionCancelled: boolean }> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data, error: rpcError } = await this.client.rpc('cancel_account_deletion');
    if (rpcError) throw rpcError;
    return { deletionCancelled: data === true };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async requestAccountDeletion(): Promise<void> {
    const { error } = await this.client.rpc('request_account_deletion');
    if (error) throw error;
  }

  async availableProviders(): Promise<SignInProvider[]> {
    if (!this.config) return [];
    try {
      const res = await fetch(`${this.config.url}/auth/v1/settings`, {
        headers: { apikey: this.config.anonKey },
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { external?: Record<string, unknown> };
      return SIGN_IN_PROVIDERS.filter((p) => body.external?.[p] === true);
    } catch {
      return [];
    }
  }

  async startProviderSignIn(provider: SignInProvider, from: From, returnTo: string): Promise<void> {
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ provider, from, returnTo, startedAt: Date.now() }),
      );
    } catch {
      // Without the record the callback cannot tell where to go; it falls back to the trip list.
    }
    const { error } = await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      takePending();
      throw error;
    }
  }

  completeProviderSignIn(url: URL): Promise<ProviderSignInOutcome> {
    if (this.completing?.href === url.href) return this.completing.result;
    const result = this.finishProviderSignIn(url);
    this.completing = { href: url.href, result };
    return result;
  }

  private async finishProviderSignIn(given: URL): Promise<ProviderSignInOutcome> {
    const opened = this.openedAt;
    const url =
      !hasCallbackParams(given) && opened && opened.pathname === given.pathname ? opened : given;
    const kind = providerCallbackKind(callbackParams(url));
    const pending = takePending();
    try {
      if (!pending) {
        // Another tab, an expired record or a link opened by hand: never sign in from it.
        if (kind === 'signed-in') await this.client.auth.signOut();
        return { kind: 'error', provider: null, returnTo: '/signin' };
      }
      if (kind !== 'signed-in') {
        return { kind, provider: pending.provider, returnTo: pending.from };
      }
      if (!(await this.sessionReady())) {
        return { kind: 'error', provider: pending.provider, returnTo: pending.from };
      }
      const { data, error } = await this.client.rpc('cancel_account_deletion');
      if (error) {
        await this.client.auth.signOut();
        return { kind: 'error', provider: pending.provider, returnTo: pending.from };
      }
      return {
        kind: 'signed-in',
        provider: pending.provider,
        deletionCancelled: data === true,
        returnTo: pending.returnTo,
      };
    } catch {
      return {
        kind: 'error',
        provider: pending?.provider ?? null,
        returnTo: pending?.from ?? '/signin',
      };
    }
  }

  /** Waits for the session the client library builds from the tokens in the address. */
  private async sessionReady(): Promise<boolean> {
    const { data } = await this.client.auth.getSession();
    if (data.session) return true;
    return new Promise<boolean>((resolve) => {
      const { data: sub } = this.client.auth.onAuthStateChange((_event, session) => {
        if (session) done(true);
      });
      const timer = setTimeout(() => done(false), SESSION_WAIT_MS);
      function done(ok: boolean) {
        clearTimeout(timer);
        sub.subscription.unsubscribe();
        resolve(ok);
      }
    });
  }

  currentUser(): AuthUser | null {
    return this.user;
  }

  onAuthChange(cb: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      cb(toUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }
}

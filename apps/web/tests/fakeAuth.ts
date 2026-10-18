import type {
  AuthService,
  AuthUser,
  ProviderSignInOutcome,
  SignInMethod,
  SignInProvider,
} from '@cellar/core';
import { vi } from 'vitest';
import { withServices } from './setup';

export type FakeAuth = AuthService & {
  signIn: ReturnType<typeof vi.fn>;
  startProviderSignIn: ReturnType<typeof vi.fn>;
  completeProviderSignIn: ReturnType<typeof vi.fn>;
  requestPasswordReset: ReturnType<typeof vi.fn>;
};

/** A signed-in user for tests; `methods` defaults to email only. */
export const fakeUser = (methods: SignInMethod[] = ['email']): AuthUser => ({
  id: 'u1',
  email: 'ana@example.com',
  methods,
});

/**
 * A fake AuthService. `providers` is what `availableProviders` resolves with (or rejects when
 * `providersFail`); `startFails` makes `startProviderSignIn` reject; `outcome` is what
 * `completeProviderSignIn` resolves with.
 */
export function fakeAuth(
  opts: {
    providers?: SignInProvider[];
    providersFail?: boolean;
    user?: AuthUser | null;
    startFails?: boolean;
    outcome?: ProviderSignInOutcome;
  } = {},
): FakeAuth {
  const {
    providers = [],
    providersFail = false,
    user = null,
    startFails = false,
    outcome = { kind: 'signed-in', provider: 'google', deletionCancelled: false, returnTo: '/' },
  } = opts;
  return {
    signUp: vi.fn(async () => {}),
    signIn: vi.fn(async () => ({ deletionCancelled: false })),
    signOut: vi.fn(async () => {}),
    requestPasswordReset: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    requestAccountDeletion: vi.fn(async () => {}),
    availableProviders: vi.fn(async () => {
      if (providersFail) throw new Error('unavailable');
      return providers;
    }),
    startProviderSignIn: vi.fn(async () => {
      if (startFails) throw new Error('unavailable');
    }),
    completeProviderSignIn: vi.fn(async () => outcome),
    currentUser: () => user,
    onAuthChange: () => () => {},
  };
}

/** Wraps a component in services where only the given auth service exists. */
export const withAuth = (auth: AuthService) => withServices({ auth, ready: Promise.resolve() });

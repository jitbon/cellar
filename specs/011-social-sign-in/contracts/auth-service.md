# Contract: AuthService additions and callback outcomes

## `AuthService` (packages/core/src/ports.ts)

Existing members are unchanged. New members:

```ts
/** Providers turned on in the account service; [] when unknown or the request fails. */
availableProviders(): Promise<SignInProvider[]>;

/**
 * Saves the pending sign-in (provider, from, returnTo) and leaves the page for the provider.
 * Rejects only if the redirect could not start (the page stays; caller shows the error).
 */
startProviderSignIn(provider: SignInProvider, from: '/signin' | '/signup', returnTo: string): Promise<void>;

/**
 * Called by /auth/callback. Reads the pending record and the callback URL, waits for the session
 * when tokens are present, runs cancel_account_deletion after a successful sign-in, clears the
 * pending record, and never throws.
 */
completeProviderSignIn(url: URL): Promise<ProviderSignInOutcome>;
```

`currentUser()` and `onAuthChange` now return `AuthUser` with `methods`.

## Core functions (packages/core/src/auth/providers.ts)

```ts
export const SIGN_IN_PROVIDERS: readonly SignInProvider[]; // ['google', 'apple', 'facebook']
export const METHOD_LABEL: Record<SignInMethod, string>;   // 'Email and password', 'Google', …

/** Ordered, de-duplicated known methods from the account service's provider list. */
export function signInMethods(providers: unknown): SignInMethod[];

/** Maps callback parameters (query and fragment merged) to an outcome kind (research R7). */
export function providerCallbackKind(params: URLSearchParams):
  'signed-in' | 'cancelled' | 'email-not-verified' | 'no-email' | 'error';

/** Message for a failed outcome, naming the provider when known. */
export function providerMessage(kind: Exclude<…, 'signed-in'>, provider: SignInProvider | null): string;
```

## Web routes and UI

| Route / component | Behavior |
|---|---|
| `/signin`, `/signup` | `ProviderButtons` above the email form: one "Continue with {Provider}" button per available provider, brand mark + text, full width, ≥ 44 px tall; disabled while a redirect starts. A divider "or" separates them from the email form. A failed outcome shows as a `Banner` at the top. |
| `/auth/callback` | Public route. Shows "Signing you in…" with a live region; calls `completeProviderSignIn`; on `signed-in` navigates to `returnTo` (or shows the deletion-cancelled note first, as the sign-in page does today); otherwise navigates to `from` with the outcome in router state. |
| `/settings` Account section | Email, then "Sign-in methods: Email and password, Google" as text. |

## E2E interception (test only)

| Request | Mocked response |
|---|---|
| `GET {SUPABASE_URL}/auth/v1/settings` | real body with `external.google/apple/facebook = true` |
| `GET {SUPABASE_URL}/auth/v1/authorize?provider=X&redirect_to=…` | `302` to `redirect_to` + `#access_token=…&refresh_token=…&expires_in=3600&token_type=bearer` (real session for a test account) or `#error=access_denied…` / `?error=server_error&error_code=provider_email_needs_verification…` |

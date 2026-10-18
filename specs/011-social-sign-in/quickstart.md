# Quickstart: Sign In with Google, Apple and Facebook

## Automated checks

```sh
pnpm lint && pnpm --filter web typecheck && pnpm test
# from apps/web, with the usual VITE_/SUPABASE_ env vars:
pnpm exec playwright test e2e/auth-providers.spec.ts e2e/a11y.spec.ts
```

The e2e suite mocks the provider round trip (research R10), so it needs no provider keys.

## Local setup with real providers (project owner)

1. Create the developer apps (research R11) and put the keys in a gitignored `supabase/.env`:
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `…_SECRET` (same for APPLE, FACEBOOK), and set
   `enabled = true` for each provider in `supabase/config.toml` (the CLI cannot read a boolean
   from `env()`, so this one is edited by hand and not committed). In each provider console, add the redirect `http://127.0.0.1:54321/auth/v1/callback`.
2. Restart the local stack so Auth reads the new config: `supabase stop && supabase start`
   (data is kept). Only the project owner does this.
3. Check: `curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: <anon>"` shows the
   providers you configured as `true`, and `[auth.email] enable_confirmations = true`.

## Scenarios (with at least Google configured)

Scenarios 6 and 7 (linking and the unconfirmed sign-up's password) are behavior of Supabase Auth
v2.197.0, not Cellar code (research R2-R3). Repeat them after every upgrade of the auth service.

1. **Buttons**: `/signin` and `/signup` show "Continue with Google" (and only providers that are
   on). With none on, the pages look as before.
2. **New account (US1)**: Continue with Google with an email Cellar has never seen → trip list,
   signed in; Settings shows the email and "Google".
3. **Return**: sign out, continue with Google → same account and trips.
4. **Cancel**: continue with Google, then cancel on Google's screen → back on the starting page
   with "Sign-in with Google was cancelled."; no new account in Studio → Authentication.
5. **Deletion cancelled (FR-004)**: request account deletion, sign out, continue with Google →
   deletion-cancelled note, account still there.
6. **Linking (US4/FR-005)**: create and confirm an email account with a trip using your Google
   address (Inbucket at http://127.0.0.1:54324), sign out, continue with Google → that trip is
   there; Settings shows "Email and password, Google"; email and password still signs in.
7. **Unconfirmed sign-up (FR-007)**: sign up with email and password using a Google address but do
   not confirm; continue with Google → signed in; signing in with the unconfirmed password fails.
8. **Provider-only password (FR-011)**: with a Google-only account, use "Forgot your password?",
   set a password, sign in with email.
9. **Destination (FR-003)**: open a trip link while signed out, continue with Google → that trip.
10. **Apple "Hide My Email"** (if Apple is on): continue with Apple, hide email → a separate
    account under the relay address.
11. **Facebook without email** (if Facebook is on): decline email → "Facebook didn't share an email
    address…", no account.

## Production

Enable each provider in the Supabase dashboard (Authentication → Providers) with its keys; add
the site's `https://<domain>/auth/callback` to Redirect URLs; keep "Confirm email" on. Apple's
client secret expires every six months: set a reminder to regenerate it.

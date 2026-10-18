# Research: Sign In with Google, Apple and Facebook

Findings are from the Supabase Auth (GoTrue) source at the version running locally,
**v2.197.0** (`supabase/auth` on GitHub), plus the local `supabase/config.toml` and the web app.

## R1 — Provider sign-in goes through the existing account service

- **Decision**: Use Supabase Auth's built-in Google, Apple and Facebook providers via
  `signInWithOAuth` with a full-page redirect (`redirectTo` = `{origin}/auth/callback`). Secrets
  live only in Supabase Auth's configuration (env vars locally, dashboard in production).
- **Rationale**: Accounts already live there (spec Assumptions); it handles each provider's
  protocol (Apple's form-post callback, Facebook's Graph API), sessions and refresh. No new
  service, no secrets in the client (FR-015, Constitution IV).
- **Alternatives**: Provider SDKs in the browser plus `signInWithIdToken` (Google One Tap, Apple
  JS) — more code per provider and pop-up/iframe behavior the spec avoids; a separate identity
  service — rejected (Constitution V).

## R2 — Automatic linking is GoTrue's default and matches FR-005/FR-006

From `internal/models/linking.go` (`DetermineAccountLinking`):

- An unknown provider identity whose **verified** email matches exactly one existing user gets
  `LinkAccount`; no match → `CreateAccount`.
- Only provider emails marked verified count (`email.Verified || config.Mailer.Autoconfirm`).
  With no verified email, the candidate email is cleared when a user already owns it, so the
  sign-in cannot land in that user's account (FR-006). In `external.go` the sign-in is then refused
  with `error_code=provider_email_needs_verification` unless `AllowUnverifiedEmailSignIns`.
- **Decision**: Rely on this behavior. Keep `[auth.email] enable_confirmations = true`
  (autoconfirm off) locally and in production, and keep "allow unverified email sign-ins" off.
  Both are current settings; the plan adds a check to the quickstart.
- **Alternatives**: A custom "link accounts?" step — rejected in clarification (auto-link).

## R3 — Unconfirmed email sign-ups lose their password when a provider claims the email (FR-007)

From `internal/api/external.go` and `internal/models/user.go`: after linking to a user who is
not confirmed, GoTrue calls `RemoveUnconfirmedIdentities`, which deletes the user's other
identities and sets `EncryptedPassword = nil` when the new identity is not `email`/`phone`; the
user is then confirmed (provider email verified).

- **Decision**: FR-007 needs no Cellar code; it is covered by GoTrue at this version. The
  quickstart includes a manual check with a real provider; an upgrade of the auth service should
  repeat it.

## R4 — Which providers are on (FR-010)

`GET /auth/v1/settings` (public, anon key) returns `external: { google, apple, facebook, … }`
booleans; verified locally (all `false` today, `email: true`).

- **Decision**: The auth adapter reads it once per page load
  (`availableProviders()`); the sign-in and create-account pages show buttons only for `true`
  providers, in the order Google, Apple, Facebook. If the request fails, no provider buttons
  show and email still works (FR-010, SC-005).
- **Alternatives**: Build-time env flags per provider — a second place to keep in sync with the
  real configuration; rejected.

## R5 — Keep the implicit flow; a callback page finishes sign-in

The client uses supabase-js defaults (implicit flow: tokens return in the URL fragment and are
picked up automatically).

- **Decision**: Keep the implicit flow. A new `/auth/callback` route waits for the session, then
  runs the existing `cancel_account_deletion` RPC (FR-004) and navigates to the saved
  destination (FR-003).
- **Rationale**: Switching to PKCE would also change email confirmation and password-reset links
  to require the same browser that requested them, breaking resets opened on another device
  (FR-011). Implicit is what email links use today.
- **Alternatives**: PKCE for providers only — supabase-js sets the flow per client; two clients
  would share one session store and complicate sign-out. Rejected for now.

## R6 — Remembering where the person was going and which provider they used

- **Decision**: Before redirecting, store `{ provider, returnTo, startedAt }` in
  `sessionStorage` under `cellar:providerSignIn`. The callback page reads and clears it.
  `returnTo` passes through the existing `safeReturnTo` check. Without the record (another tab,
  expired, or a sign-in finished on another device) the callback shows the generic error and does
  not sign in.
- **Rationale**: Keeps the redirect URL fixed (one allow-listed address) and lets error messages
  name the provider (FR-009).

## R7 — Mapping the callback result to messages

GoTrue redirects to `redirectTo` with `error`, `error_code` and `error_description` (query or
fragment). A pure core function maps them:

| Callback | Outcome | Message |
|---|---|---|
| tokens, no error | `signed-in` | (trip list or destination; deletion note if cancelled) |
| `error=access_denied` | `cancelled` | "Sign-in with {Provider} was cancelled." |
| `error_code=provider_email_needs_verification` | `email-not-verified` | "{Provider} didn't confirm your email. Sign in with your email and password instead." |
| description mentions getting the user email | `no-email` | "{Provider} didn't share an email address. Allow email access or use another option." |
| anything else, or no pending record | `error` | "Couldn't sign in with {Provider}. Try again or use another option." |

The person returns to the page they started from (sign-in or create-account) with the message.

## R8 — Showing sign-in methods (FR-012)

The session user carries `app_metadata.providers` (e.g. `["email", "google"]`).

- **Decision**: `AuthUser` gains `methods: SignInMethod[]` from that list (unknown entries
  ignored), ordered Email and password, Google, Apple, Facebook. Settings shows them as text.

## R9 — Profile data the account service keeps (FR-013) — spec reworded, agreed 2026-10-18

GoTrue's provider code stores the provider's basic profile claims (name, picture URL) in the
account's metadata and identity records automatically; scopes can be added but not removed
(`email` and `profile`/`public_profile` are the defaults).

- **Decision**: Cellar requests no extra scopes and never reads or shows those fields. FR-013's
  "store nothing else" cannot hold literally; the plan proposes rewording it to "Cellar requests
  no scopes beyond the defaults and does not use or display profile data; the account service
  keeps the basic profile the provider sends." Stripping the data with a trigger on the account
  service's tables was rejected (fragile, rewritten on each sign-in).

## R10 — Testing without real providers

GoTrue's Google provider ignores any URL override (`google.go` logs a warning) and Apple and
Facebook endpoints are fixed too, so a local stand-in provider cannot be plugged into GoTrue for
these three without restarting the local stack with test-only providers.

- **Decision**:
  - **Core** (Vitest): callback outcome mapping (R7), method ordering (R8), return-path checks.
  - **Web** (Vitest): buttons shown per `availableProviders`, accessible names, callback page
    outcomes with a fake `AuthService`.
  - **E2E** (Playwright): the browser's calls to the auth service are intercepted.
    `/auth/v1/settings` reports the providers on; `/auth/v1/authorize?provider=…` answers with a
    redirect to `/auth/callback` carrying either a real session for a test account (created with
    the admin API) or an `error` / `error_code`. This exercises Cellar's whole flow: buttons,
    redirect, callback, deletion cancel, destination, messages, Settings.
  - **Linking (R2/R3)** is the account service's behavior; it is checked by hand with real Google
    (quickstart 6–7) once Google keys are set locally.
- **Alternatives**: Keycloak provider pointed at a mock OpenID server — tests GoTrue's linking for
  real but needs a different provider than the three we ship and a local stack restart; kept as an
  option if linking regressions appear.

## R11 — Provider setup and redirect addresses

- Supabase Auth callback (what each provider console lists): `{SUPABASE_URL}/auth/v1/callback`.
- Cellar's `redirectTo` addresses must be in Auth's redirect allow-list:
  `http://localhost:*/auth/callback` locally (`additional_redirect_urls`), and the production
  origin's `/auth/callback` in the dashboard.
- Local `config.toml` gets `[auth.external.google|apple|facebook]` sections reading client ids and
  secrets from `env(...)`, `enabled = env(...)` defaulting off, so nothing turns on without keys.
  Changing it requires restarting the local stack, which only the project owner does.
- **Apple**: needs a Services ID, a key, and a client secret (a signed token) that expires every
  six months; renewal goes in the quickstart. Apple shares the email only on the first sign-in;
  the account service keeps it.
- **Facebook**: app in Live mode needs Meta app review for the `email` permission and business
  verification; until then only app testers can sign in.

---

description: "Task list for Sign In with Google, Apple and Facebook"
---

# Tasks: Sign In with Google, Apple and Facebook

**Input**: Design documents from `/specs/011-social-sign-in/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-service.md,
quickstart.md

**Tests**: Included. Constitution Principle V requires tests for core logic; research R10 sets the
core, web and e2e test approach. Tests are written first and must fail before the implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US5)

## Path Conventions

Monorepo: `packages/core/`, `apps/web/`, `supabase/`. Outcome mapping and messages: research R7.
Pending record: data-model.md ("records older than 10 minutes are ignored"). Contract:
contracts/auth-service.md. Supabase Auth does linking (R2–R3): Cellar writes no linking code.

---

## Phase 1: Setup

- [X] T001 Add `supabase/.env` to `.gitignore` (provider keys; research R11), and confirm with `git check-ignore supabase/.env`
- [X] T002 [P] In `supabase/config.toml`: add `[auth.external.google]`, `[auth.external.facebook]` and update `[auth.external.apple]` with `enabled = env(SUPABASE_AUTH_EXTERNAL_<P>_ENABLED)`, `client_id = env(SUPABASE_AUTH_EXTERNAL_<P>_CLIENT_ID)`, `secret = env(SUPABASE_AUTH_EXTERNAL_<P>_SECRET)` (empty `redirect_uri`/`url`, `skip_nonce_check = false`, `email_optional = false`); add `"http://localhost:*/auth/callback"` and `"http://127.0.0.1:*/auth/callback"` to `additional_redirect_urls`; leave `[auth.email] enable_confirmations = true`. Do not restart the local stack (project owner only); note in the commit that it takes effect on the next restart. Verify the env() form for `enabled` is accepted by `supabase` config parsing (`supabase status` still works); if booleans cannot come from env, use `enabled = false` with a comment pointing to quickstart step 1

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Add types `SignInProvider = 'google' | 'apple' | 'facebook'`, `SignInMethod = 'email' | SignInProvider`, `ProviderSignInOutcome` (data-model.md) and `AuthUser.methods: SignInMethod[]` to `packages/core/src/ports.ts`; add `availableProviders()`, `startProviderSignIn(provider, from, returnTo)` and `completeProviderSignIn(url)` to `AuthService` exactly as in contracts/auth-service.md
- [ ] T004 Create `packages/core/src/auth/providers.ts` as stubs (`SIGN_IN_PROVIDERS = ['google', 'apple', 'facebook']`, `METHOD_LABEL`, `signInMethods`, `providerCallbackKind`, `providerMessage` returning placeholders) and export them and the new types from `packages/core/src/index.ts`, so tests compile
- [ ] T005 [P] Write failing tests in `packages/core/tests/auth-providers.test.ts`: `METHOD_LABEL` = Email and password / Google / Apple / Facebook; `signInMethods(['google','email','github',null,'google'])` → `['email','google']` and non-arrays → `[]`; `providerCallbackKind` for: `access_token` present → `signed-in`; `error=access_denied` → `cancelled`; `error_code=provider_email_needs_verification` → `email-not-verified`; `error_description` containing "Error getting user email from external provider" → `no-email`; other `error` → `error`; no tokens and no error → `error`; `providerMessage` texts exactly as research R7, with "Google"/"Apple"/"Facebook" and a provider-less fallback ("Couldn't sign in. Try again or use another option.")
- [ ] T006 Implement `packages/core/src/auth/providers.ts` per research R7–R8; make T005 pass
- [ ] T007 Create a fake `AuthService` for web tests in `apps/web/tests/fakeAuth.ts` (configurable `providers`, `user` with `methods`, records `startProviderSignIn` calls, scripted `completeProviderSignIn` outcome) and a `withAuth(fake)` wrapper using the existing services provider in `apps/web/src/state/services.tsx`
- [ ] T008 In `apps/web/src/adapters/supabaseAuthService.ts`: `toUser` fills `methods` with `signInMethods(user.app_metadata?.providers)` (email-only users → `['email']`); keep all existing methods unchanged (FR-011)

**Checkpoint**: Core helpers tested; the port, adapter and fake compile; existing tests pass

---

## Phase 3: User Story 1 - Sign up or sign in with Google (Priority: P1) 🎯 MVP

**Goal**: "Continue with Google" creates an account or signs in, returns to the destination, cancels a pending deletion, and reports cancel/errors on the starting page.

**Independent Test**: Quickstart 1–5 and 9 (and the mocked e2e below).

### Tests for User Story 1

- [ ] T009 [P] [US1] Write failing `apps/web/tests/ProviderButtons.test.tsx`: renders one button per available provider in the order Google, Apple, Facebook with accessible names "Continue with Google" etc. and visible text; renders nothing (no divider) when `availableProviders` resolves `[]` or rejects; clicking calls `startProviderSignIn(provider, from, returnTo)` once and disables all buttons while it is pending; a rejected start re-enables them and shows "Couldn't sign in with Google. Try again or use another option."
- [ ] T010 [P] [US1] Write failing `apps/web/tests/AuthCallback.test.tsx`: shows "Signing you in…" in a `role="status"` region; `signed-in` navigates to `returnTo` (replace); `signed-in` with `deletionCancelled` shows the same deletion-cancelled note as `SignIn` before continuing; `cancelled`/`error`/`email-not-verified`/`no-email` navigate to `from` with the outcome, and `SignIn` then shows `providerMessage(kind, provider)` in a `Banner`
- [ ] T011 [P] [US1] Write failing adapter tests in `apps/web/tests/supabaseAuthService.test.ts` with a stubbed Supabase client: `availableProviders` reads `external.google/apple/facebook` from `GET {url}/auth/v1/settings` (with the anon key) and returns only `true` ones in fixed order, `[]` on failure; `startProviderSignIn` writes `{provider, from, returnTo, startedAt}` to `sessionStorage['cellar:providerSignIn']` then calls `signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })`; `completeProviderSignIn` — with tokens: waits for the session, calls `rpc('cancel_account_deletion')`, clears the record, returns `signed-in` with `safeReturnTo(returnTo)`; with `error` params: returns the mapped kind without a session; with no record or a record older than 10 minutes: returns `error` and signs out any session the URL created; never throws

### Implementation for User Story 1

- [ ] T012 [US1] Implement `availableProviders`, `startProviderSignIn`, `completeProviderSignIn` in `apps/web/src/adapters/supabaseAuthService.ts` per contracts/auth-service.md and research R4–R7 (merge query and fragment params; `safeReturnTo` from `apps/web/src/pages/SignIn.tsx` moved to a shared module if needed to avoid a page import); make T011 pass
- [ ] T013 [US1] Create `apps/web/src/components/auth/ProviderButtons.tsx` (+ `ProviderButtons.module.css`, tokens only): full-width buttons ≥ 44 px tall, provider mark (inline SVG, `aria-hidden`) plus "Continue with {Provider}", Google/Apple/Facebook styling per each brand's button guidelines within contrast rules, then an "or" divider; props `from`, `returnTo`; make T009 pass
- [ ] T014 [US1] Create `apps/web/src/pages/AuthCallback.tsx` and add a public `/auth/callback` route (outside `RequireAuth`) in `apps/web/src/App.tsx`; make T010's callback cases pass
- [ ] T015 [US1] In `apps/web/src/pages/SignIn.tsx` and `apps/web/src/pages/SignUp.tsx`: render `ProviderButtons` above the email form (`from` = the page, `returnTo` = the `returnTo` query param or `/`); show a failed outcome from router state as a `Banner` with `providerMessage`; keep the email forms unchanged; make T010's message cases pass
- [ ] T016 [US1] Add e2e helpers in `apps/web/e2e/helpers.ts`: `mockProviders(page, providers)` (rewrites `/auth/v1/settings` so listed providers are `true`) and `mockProviderReturn(page, provider, result)` where `result` is `{ session: Account }` (signs the account in through the Auth API in Node and answers `/auth/v1/authorize?provider=…` with a 302 to `redirect_to` + `#access_token=…&refresh_token=…&expires_in=3600&token_type=bearer`) or `{ error, errorCode?, description? }` (302 with those params)
- [ ] T017 [US1] Create `apps/web/e2e/auth-providers.spec.ts` (US1 block): Google button shown only when mocked on, and no buttons with none on; continue with Google → trip list; from a signed-out trip link → that trip (FR-003); cancel → back on `/signin` with "Sign-in with Google was cancelled."; account with deletion requested → deletion-cancelled note and the account works (FR-004); generic error → the error message and email sign-in still works (SC-005)

**Checkpoint**: Google sign-in works end to end with the mocked provider

---

## Phase 4: User Story 2 - Sign up or sign in with Apple (Priority: P2)

**Goal**: Apple works like Google; "Hide My Email" accounts work.

**Independent Test**: Quickstart 10; mocked e2e below.

- [ ] T018 [P] [US2] Extend `apps/web/e2e/auth-providers.spec.ts` (US2 block): with Apple on, "Continue with Apple" signs in an account whose email is a `@privaterelay.appleid.com` address and Settings shows that address; cancel → "Sign-in with Apple was cancelled."
- [ ] T019 [US2] Check `ProviderButtons` renders Apple's mark and black/white button per Apple's guidelines in light and dark themes (`apps/web/src/components/auth/ProviderButtons.module.css`), and add an Apple-order case to `apps/web/tests/ProviderButtons.test.tsx` if T009 did not cover all three

---

## Phase 5: User Story 4 - One account, whichever way you sign in (Priority: P2)

**Goal**: A verified provider email lands in the existing account; unverified provider emails are told to use email; provider-only accounts can add a password.

**Independent Test**: Quickstart 6–8 (real Google; Supabase Auth does the linking, research R2–R3).

- [ ] T020 [P] [US4] Extend `apps/web/e2e/auth-providers.spec.ts`: a provider return with `error_code=provider_email_needs_verification` shows "Google didn't confirm your email. Sign in with your email and password instead." on `/signin` (FR-006)
- [ ] T021 [P] [US4] Add a case to `apps/web/tests/supabaseAuthService.test.ts` (or an e2e step) confirming password reset is unchanged for an account whose `methods` are `['google']` (`requestPasswordReset` called with the same redirect as today) (FR-011)
- [ ] T022 [US4] Record in `specs/011-social-sign-in/quickstart.md` that scenarios 6–7 depend on Supabase Auth v2.197.0 behavior and must be repeated after auth upgrades (no code change)

---

## Phase 6: User Story 3 - Sign up or sign in with Facebook (Priority: P3)

**Goal**: Facebook works like Google; no email → clear message, no account.

**Independent Test**: Quickstart 11; mocked e2e below.

- [ ] T023 [P] [US3] Extend `apps/web/e2e/auth-providers.spec.ts`: with Facebook on, continue with Facebook → trip list; a return with `error=server_error&error_description=Error getting user email from external provider` shows "Facebook didn't share an email address. Allow email access or use another option." and no session exists (FR-008)
- [ ] T024 [US3] Check Facebook's mark and button colors in `apps/web/src/components/auth/ProviderButtons.module.css` meet WCAG AA text contrast in both themes

---

## Phase 7: User Story 5 - See how you sign in (Priority: P3)

**Goal**: Settings lists the account's email and sign-in methods.

**Independent Test**: Sign in with a provider to an account that also has a password; Settings shows both.

- [ ] T025 [P] [US5] Write failing `apps/web/tests/Settings.test.tsx`: Account section shows the email and "Sign-in methods: Email and password, Google" for `methods: ['email','google']`, and "Google" alone for `['google']`; no connect/disconnect controls (FR-012)
- [ ] T026 [US5] Add the methods line to the Account section in `apps/web/src/pages/Settings.tsx` using `METHOD_LABEL`; keep the account in sync via `onAuthChange`; make T025 pass
- [ ] T027 [US5] Extend `apps/web/e2e/auth-providers.spec.ts`: after a mocked Google sign-in to an account whose `app_metadata.providers` is `['email','google']` (set with the admin API), Settings shows "Email and password, Google"

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Extend `apps/web/e2e/a11y.spec.ts`: `/signin` and `/signup` with all three providers mocked on, light and dark, no serious axe violations; the callback page "Signing you in…" state
- [ ] T029 [P] Extend `apps/web/e2e/layout.spec.ts` (or the auth spec): at 360 px the provider buttons fit without horizontal scroll and each is ≥ 44 px tall; buttons are reachable and usable with Tab/Enter
- [ ] T030 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test`, the db tests and the full e2e suite; fix failures (known flakes: `e2e/perf.spec.ts` under load, `e2e/sync.spec.ts` FR-002)
- [ ] T031 Walk through `specs/011-social-sign-in/quickstart.md` — automated parts now; scenarios with real providers when the project owner has configured keys and restarted the local stack (record which were run)

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T008) → US1 (T009–T017) → US2, US4, US3, US5 (any order; each extends US1's flow) → Polish.
- US2–US4 need US1's buttons, callback and adapter; US5 needs only Foundational (T003, T008) and can run alongside US1.
- Within US1: T009–T011 (tests, parallel) → T012 → T013 → T014 → T015 → T016 → T017.

## Parallel Examples

- Foundational: T005 alongside T007.
- US1 tests: T009, T010, T011 together.
- After US1: T018, T020, T023 (separate describe blocks; same file, so merge sequentially) and T025 in parallel.
- Polish: T028 and T029.

## Implementation Strategy

US1 alone is the MVP: Google sign-in (with Apple and Facebook buttons appearing automatically once
configured, since all three share the flow). Then Apple and linking checks (P2), Facebook and
Settings (P3), polish. Turning a provider on in production needs only its keys (FR-010). Merge to
`main` after the project owner confirms.

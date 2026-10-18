# Implementation Plan: Sign In with Google, Apple and Facebook

**Branch**: `feature/011-social-sign-in` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-social-sign-in/spec.md`

## Summary

The sign-in and create-account pages gain "Continue with Google / Apple / Facebook" buttons,
shown only for providers turned on in the account service. A button saves where the person was
going, redirects to the provider through Supabase Auth, and a new `/auth/callback` page finishes
sign-in: it cancels a pending account deletion, goes to the saved destination, or returns to the
starting page with a message naming the provider. Settings lists the account's sign-in methods.

Technical approach: Supabase Auth (GoTrue v2.197.0) already implements the three providers,
automatic linking by verified email, and removal of an unconfirmed sign-up's password when a
provider claims the email ([research.md](./research.md) R1–R3), so Cellar adds no account logic of
its own: a few `AuthService` methods in the adapter, pure outcome/label helpers in core, the
buttons, the callback page and the Settings line. Providers are discovered from
`/auth/v1/settings` (R4). E2E tests intercept the provider round trip (R10).

## Technical Context

**Language/Version**: TypeScript 5.x (strict)

**Primary Dependencies**: Existing `@supabase/supabase-js` 2.x and Supabase Auth; Google, Apple
and Facebook as identity providers (configured in Auth, not called by Cellar code). No new packages.

**Storage**: No schema changes; `sessionStorage` for the pending sign-in record

**Testing**: Vitest (core helpers, web components with a fake `AuthService`), Playwright (provider
round trip mocked), manual quickstart with real Google for linking

**Target Platform**: Evergreen desktop and mobile browsers, including in-app browsers (redirect,
no pop-ups)

**Project Type**: Web application (existing monorepo)

**Performance Goals**: Buttons appear with the page; messages within 2 s of returning (SC-003)

**Constraints**: Provider secrets only in Auth config (FR-015); WCAG 2.1 AA; 360 px; provider
button guidelines (brand mark and wording); email flows unchanged (FR-011)

**Scale/Scope**: One adapter extension, one core module, one component, one route, Settings line,
config and docs

## Constitution Check

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Sign-in only; trips untouched | ✅ | ✅ |
| II. Clean, friendly interface | Text labels on every button and method; tokens; 44 px targets; 360 px; keyboard; live region on the callback page; provider marks follow brand rules but labels never rely on them | ✅ | ✅ |
| III. Portable core | Provider list, labels, method ordering and callback-outcome mapping in `packages/core/src/auth/providers.ts`; the UI uses the `AuthService` port; a native app can implement the same port | ✅ | ✅ |
| IV. Integrations behind adapters | Providers reached only through Supabase Auth via `SupabaseAuthService`; a provider that is off or failing hides or errors without blocking email sign-in (FR-010); secrets never in client or repo (`env(...)` in config.toml) | ✅ | ✅ |
| V. Simplicity & verified changes | No new services, packages or tables; linking left to the account service; core helpers unit-tested; e2e covers each flow | ✅ | ✅ |

**Third-party services (Technology & Integration Constraints)**

| Service | Purpose | Adapter | When unavailable | Data sent |
|---|---|---|---|---|
| Google, Apple, Facebook (via Supabase Auth) | Create account / sign in | `SupabaseAuthService` (`availableProviders`, `startProviderSignIn`, `completeProviderSignIn`) | Button hidden (not configured) or "Couldn't sign in with X…" message; email sign-in unaffected | The provider's own consent screen; Cellar receives the account id, email and the provider's basic profile (see R9) and uses only id and email |

No violations.

**Spec change agreed** (research R9): Supabase Auth stores the provider's basic profile (name,
picture URL) automatically; FR-013 now says Cellar requests only default permissions and never
uses or displays profile data (confirmed by the project owner 2026-10-18).

## Project Structure

```text
specs/011-social-sign-in/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/auth-service.md
└── checklists/requirements.md

packages/core/src/auth/providers.ts           # NEW provider list, labels, signInMethods, callback mapping, messages
packages/core/src/ports.ts                    # AuthUser.methods; AuthService provider methods
packages/core/src/index.ts                    # exports
packages/core/tests/auth-providers.test.ts    # NEW
apps/web/src/adapters/supabaseAuthService.ts  # availableProviders, startProviderSignIn, completeProviderSignIn, methods
apps/web/src/components/auth/ProviderButtons.tsx (+ .module.css, brand marks)   # NEW
apps/web/src/pages/AuthCallback.tsx           # NEW /auth/callback
apps/web/src/pages/SignIn.tsx, SignUp.tsx     # buttons, divider, outcome banner
apps/web/src/pages/Settings.tsx               # sign-in methods line
apps/web/src/App.tsx                          # public /auth/callback route
apps/web/tests/ProviderButtons.test.tsx, AuthCallback.test.tsx, Settings.test.tsx   # NEW
apps/web/tests/setup.ts                       # fake AuthService gains the new members
apps/web/e2e/auth-providers.spec.ts           # NEW (mocked round trip)
apps/web/e2e/helpers.ts                       # mockProviders(page, …), session for a test account
apps/web/e2e/a11y.spec.ts                     # sign-in page with buttons
supabase/config.toml                          # google/apple/facebook sections via env(), redirect allow-list
.gitignore                                    # add supabase/.env (provider keys; not ignored today)
```

## Complexity Tracking

No constitution violations to justify.

# Data Model: Sign In with Google, Apple and Facebook

No Cellar tables or migrations change. Accounts and their sign-in methods live in the account
service (Supabase Auth); trips keep referencing the account id as today.

## Core types (`packages/core`)

```text
SignInProvider = 'google' | 'apple' | 'facebook'
SignInMethod   = 'email' | SignInProvider

AuthUser
  id: string
  email: string            # for "Hide My Email" Apple accounts, the relay address
  methods: SignInMethod[]  # NEW; ordered email, google, apple, facebook; never empty when signed in

ProviderSignInOutcome      # result of returning from a provider (research R7)
  | { kind: 'signed-in', provider, deletionCancelled: boolean, returnTo: string }
  | { kind: 'cancelled' | 'email-not-verified' | 'no-email' | 'error', provider: SignInProvider | null,
      returnTo: string }   # returnTo = the page the person started from ('/signin' or '/signup')
```

Labels (UI text, core constant): Google, Apple, Facebook; email shows as "Email and password".

## Pending provider sign-in (browser `sessionStorage`, key `cellar:providerSignIn`)

```text
provider: SignInProvider
from: '/signin' | '/signup'   # where to show a message on failure
returnTo: string              # destination after success; passes safeReturnTo
startedAt: number             # ms; records older than 10 minutes are ignored
```

Written just before the redirect, read and removed by the callback page. Absent or stale →
outcome `error`, nothing signed in.

## Account service (reference, not Cellar-owned)

- `auth.users`: one row per account; `email`, `email_confirmed_at`, `encrypted_password`
  (null for provider-only accounts), `raw_app_meta_data.providers`.
- `auth.identities`: one row per sign-in method (`provider`, provider account id,
  `identity_data` with the email the provider reported).
- Linking, confirmation and unconfirmed-identity removal follow research R2–R3.
- Account deletion (`request_account_deletion`, 30-day purge) removes the user and so every
  identity; `cancel_account_deletion` runs after any sign-in.

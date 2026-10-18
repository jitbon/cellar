# Feature Specification: Sign In with Google, Apple and Facebook

**Feature Branch**: `feature/011-social-sign-in`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "setup logins for user accounts now. I think the signup with
facebook/google/apple and email would be good"

## Context

Cellar already has email accounts: sign up with email and password (with a confirmation email),
sign in, password reset, sign out, and account deletion with a 30-day grace period that a new
sign-in cancels. This feature adds Google, Apple and Facebook as further ways to create an account
and sign in, alongside email, and makes the email path work cleanly with them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up or sign in with Google (Priority: P1)

A new traveler opens Cellar, chooses "Continue with Google", approves on Google's own screen, and
lands on their (empty) trip list, without choosing a password or confirming an email. Next time,
the same button signs them straight back in to the same account and trips.

**Why this priority**: Google is the most widely held of the three and the quickest path to a
first trip; it alone delivers the feature's value (no password to create or remember).

**Independent Test**: With Google enabled, a person with no Cellar account continues with Google,
creates a trip, signs out, continues with Google again, and sees that trip.

**Acceptance Scenarios**:

1. **Given** a person with no Cellar account, **When** they choose "Continue with Google" on the
   sign-in or the create-account page and approve, **Then** a Cellar account is created for their
   Google email and they arrive at their trip list, signed in.
2. **Given** that account exists, **When** they continue with Google again later (any device),
   **Then** they are signed in to the same account and see the same trips.
3. **Given** they cancel or close Google's screen, **When** they return to Cellar, **Then** they
   are on the page they started from, not signed in, with a short note that sign-in was cancelled
   and every other sign-in option still available.
4. **Given** the account had asked for deletion within the last 30 days, **When** they continue
   with Google, **Then** the deletion is cancelled, exactly as an email sign-in does today, and
   they are told so.

---

### User Story 2 - Sign up or sign in with Apple (Priority: P2)

A traveler on an iPhone or Mac chooses "Continue with Apple", approves with Face ID, Touch ID or
their Apple password, and is signed in, including when they choose Apple's "Hide My Email".

**Why this priority**: Expected by iPhone users and required by Apple for the future iOS app once
other social sign-ins are offered; second to Google in reach.

**Independent Test**: With Apple enabled, a person continues with Apple (once sharing their email,
once hiding it), creates a trip each time, signs out and back in with Apple, and sees that trip.

**Acceptance Scenarios**:

1. **Given** a person with no Cellar account, **When** they continue with Apple and approve,
   **Then** an account is created and they are signed in.
2. **Given** they chose "Hide My Email", **When** the account is created, **Then** it works like
   any other account; its email is the private relay address Apple provides, and it is a
   separate account from any Cellar account under their real email.
3. **Given** cancellation or deletion-in-progress, **Then** behavior matches User Story 1
   scenarios 3 and 4.

---

### User Story 3 - Sign up or sign in with Facebook (Priority: P3)

A traveler chooses "Continue with Facebook", approves on Facebook's screen, and is signed in.

**Why this priority**: Requested, but the least needed of the three for a trip planner, and it
needs the most setup (a reviewed Facebook app) before it can go live.

**Independent Test**: With Facebook enabled, a person continues with Facebook, creates a trip,
signs out and back in with Facebook, and sees that trip.

**Acceptance Scenarios**:

1. **Given** a person with no Cellar account, **When** they continue with Facebook and approve
   sharing their email, **Then** an account is created and they are signed in.
2. **Given** their Facebook account has no email, or they decline to share it, **When** they
   return to Cellar, **Then** no account is created and they see a message asking them to share
   their email or use another sign-in option.
3. **Given** cancellation or deletion-in-progress, **Then** behavior matches User Story 1
   scenarios 3 and 4.

---

### User Story 4 - One account, whichever way you sign in (Priority: P2)

A traveler who already has an email-and-password account later chooses "Continue with Google"
with the same email address. They land in their existing account with all their trips, not a new
empty one. From then on either method works.

**Why this priority**: Without it, existing users who try a social button would appear to lose
their trips; it protects existing data as soon as any social option ships.

**Independent Test**: Create an email account (confirmed) with a trip; sign out; continue with
Google using the same email; the trip is there. Sign out; sign in with email and password; the
trip is still there.

**Acceptance Scenarios**:

1. **Given** a confirmed email account and a Google, Apple or Facebook login whose provider
   reports the same, verified email, **When** they continue with that provider, **Then** they are
   signed in to the existing account, and both methods keep working afterwards.
2. **Given** an email sign-up that was never confirmed, **When** someone continues with a provider
   using that email, **Then** they get a working account for that email, and the unconfirmed
   password does not grant access to it.
3. **Given** a provider that does not report the email as verified, **When** the person continues,
   **Then** they are not signed in to the existing email account; they see a message to sign in
   with email and password instead.
4. **Given** a person who signed up with a provider only, **When** they use "Forgot your password?"
   with that email, **Then** they can set a password and sign in with email from then on.

---

### User Story 5 - See how you sign in (Priority: P3)

In Settings, the Account section shows the signed-in email and which sign-in methods the account
has (Email and password, Google, Apple, Facebook).

**Why this priority**: Helpful for remembering which button to use; not needed to sign in.

**Independent Test**: Sign in with Google to an account that also has a password; Settings lists
"Google" and "Email and password".

**Acceptance Scenarios**:

1. **Given** a signed-in account, **When** they open Settings, **Then** they see their email and
   the list of sign-in methods on the account, each with its provider's name in text.

---

### Edge Cases

- A provider is not set up in an environment (no keys yet): its button is not shown; the other
  methods work.
- The provider is down or returns an error: the person returns to the page they started on with
  "Couldn't sign in with {Provider}. Try again or use another option." Nothing is created.
- The person switches provider accounts on the provider's screen (e.g. a different Google
  account): they are signed in as that account's email, which may be a different Cellar account.
- Signed in already and opening the sign-in page: they go to their trip list, as today.
- A sign-in started on one device and finished on another (rare with providers): it fails
  safely with the cancelled/error message; nothing is created.
- Pop-up blockers and in-app browsers: the flow uses a full-page redirect to the provider and
  back, so it does not depend on pop-ups.
- The page they were trying to reach before signing in (e.g. a shared trip link) is still
  where they land after any sign-in method, as with email today.
- Deleting an account removes it for every sign-in method; a later social sign-in with the
  same provider after the 30 days creates a new, empty account.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sign-in and create-account pages MUST offer "Continue with Google", "Continue
  with Apple" and "Continue with Facebook" buttons, above the email form, each with its
  provider's mark and name in text, following each provider's button guidelines.
- **FR-002**: A provider button MUST create an account on first use and sign in to the same
  account afterwards; the same buttons serve both pages.
- **FR-003**: After any successful sign-in, the person MUST land where email sign-in sends them
  today (the page they were headed to, else the trip list).
- **FR-004**: Any sign-in with a provider MUST cancel a pending account deletion and say so, as
  email sign-in does.
- **FR-005**: When a provider reports a verified email that matches an existing confirmed
  account, the sign-in MUST go to that existing account and add the provider to it.
- **FR-006**: A provider sign-in MUST NOT attach to an existing account when the provider does
  not report the email as verified; the person MUST be told to use email and password.
- **FR-007**: An unconfirmed email sign-up's password MUST NOT give access to an account later
  created or claimed through a provider with the same email.
- **FR-008**: Without a usable email from the provider (e.g. Facebook without email), no account
  is created and the person MUST see a message offering the other options.
- **FR-009**: Cancelling on the provider's screen or a provider error MUST return the person to
  the page they started from, not signed in, with a short message naming the provider; nothing
  is created.
- **FR-010**: A provider without configuration in the current environment MUST NOT show its
  button; the remaining methods MUST keep working.
- **FR-011**: Email sign-up, confirmation, sign-in and password reset MUST keep working as today;
  password reset MUST also let a provider-only account add a password.
- **FR-012**: Settings MUST show the account's email and its sign-in methods by name.
- **FR-013**: Cellar MUST request only the person's email and account identifier from providers
  (no contacts, friends, photos or posting rights), and MUST store nothing else from them.
- **FR-014**: All new controls MUST meet WCAG 2.1 AA, work at 360 px wide, and work with the
  keyboard alone; provider buttons MUST have accessible names "Continue with {Provider}".
- **FR-015**: Provider secrets MUST NOT appear in client code or the repository.

### Key Entities

- **Account**: one Cellar user; owns trips. Has one email and one or more sign-in methods.
- **Sign-in method**: email and password, Google, Apple or Facebook, linked to an account; for
  providers, identified by the provider's account identifier and the email it reported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new person can go from the sign-in page to their trip list with Google or Apple
  in under 30 seconds and at most 3 taps or clicks in Cellar.
- **SC-002**: 100% of sign-ins with a provider whose verified email matches an existing confirmed
  account open that existing account (no duplicate, empty accounts in testing).
- **SC-003**: Cancelling or failing at a provider leaves no new account in 100% of tests, and the
  person sees a message within 2 seconds of returning.
- **SC-004**: Existing email accounts continue to sign in, reset passwords and delete accounts
  with no change in behavior (all existing account tests pass).
- **SC-005**: With any one provider unavailable, the other sign-in methods succeed.

## Assumptions

- Accounts and sign-in stay on Cellar's existing account service, which supports these providers;
  no new account system is introduced.
- Linking by verified email is automatic (no "link accounts?" prompt), the common approach for
  consumer apps; Apple's "Hide My Email" addresses never match an existing account.
- Connecting or disconnecting providers from Settings, changing the account email, and
  two-factor sign-in are out of scope; Settings only shows the methods.
- No profile name or photo is taken from providers; the app has no profile today.
- Magic-link (passwordless email) sign-in is out of scope; email keeps using a password.

## Dependencies

- Each provider needs a developer app set up by the project owner before its button can go live:
  - **Google**: a Google Cloud OAuth client (free).
  - **Apple**: an Apple Developer Program membership (paid, yearly) for "Sign in with Apple".
  - **Facebook**: a Meta developer app; going public needs Meta's app review and business
    verification, which can take days to weeks.
- Each provider's settings must list Cellar's sign-in return address for every environment
  (local and production).
- Local development and automated tests cannot reach real providers; they use a stand-in that
  behaves like a provider so flows can be tested end to end.

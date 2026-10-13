<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles (template placeholder → new title):
  - [PRINCIPLE_1_NAME] → I. Flexible Block-Based Planning
  - [PRINCIPLE_2_NAME] → II. Clean, Friendly Interface
  - [PRINCIPLE_3_NAME] → III. Portable Core (Web First, Mobile Next)
  - [PRINCIPLE_4_NAME] → IV. Integrations Behind Adapters
  - [PRINCIPLE_5_NAME] → V. Simplicity & Verified Changes
- Added sections: Technology & Integration Constraints; Development Workflow; Governance
- Removed sections: none
- Templates: plan/spec/tasks templates read this file at runtime; no edits made here
- Follow-up TODOs: none
-->

# Cellar Constitution

## Core Principles

### I. Flexible Block-Based Planning

Cellar exists to make vacation planning flexible and fast. The schedule is a grid of days ×
time blocks (e.g. "Morning", "Breakfast", "Post-breakfast", "Lunch", "Afternoon").

- Time blocks MUST be user-defined: users can add, rename, reorder, and remove blocks per trip.
  The app MUST NOT force fixed clock times or a fixed block set (defaults are allowed).
- Users MUST be able to build a library of candidate items (activities, food places) and place
  them into any block by copy or move, at least as easily as copy/paste in a spreadsheet.
- A block MAY hold zero, one, or several items; items MAY be unscheduled.
- Every planning action MUST be undoable or otherwise reversible without data loss.

Rationale: the app replaces a spreadsheet workflow; if it is less flexible than Google Sheets,
it has failed.

### II. Clean, Friendly Interface

- All UI MUST use a shared set of design tokens (color, spacing, radius, typography). Ad-hoc
  values in components are not allowed. The visual language is clean and soft: rounded corners,
  generous spacing, restrained color.
- Layouts MUST work from phone width (≥360px) up to desktop, designed mobile-first.
- UI MUST meet WCAG 2.1 AA for contrast, keyboard access, and labeled controls.
- Status (e.g. weather on a block) MUST be shown with an icon or label as well as color.

Rationale: ease of use is the product; consistency via tokens keeps the look clean as features
grow and eases the mobile port.

### III. Portable Core (Web First, Mobile Next)

- Domain logic (trips, days, blocks, items, scheduling rules) MUST live in a platform-agnostic
  core with no dependency on browser/DOM APIs or a specific UI framework.
- UI layers MUST consume the core through its public interface only.
- Platform-specific features (storage, geolocation, notifications) MUST be accessed through
  interfaces so web and mobile can provide their own implementations.

Rationale: the app is planned to ship on mobile; keeping the core portable avoids a rewrite.

### IV. Integrations Behind Adapters

External services (weather forecasts, maps, place reviews, AI assistants) are enhancements,
not dependencies.

- Each external service MUST be accessed through an adapter interface owned by Cellar, so the
  provider can be swapped without touching core or UI code.
- Planning MUST remain fully usable when any integration is unavailable, slow, or not
  configured; failures MUST degrade to a clear "unavailable" state, never block editing.
- API keys and secrets MUST NOT ship in client code or be committed to the repository.
- AI features MUST propose changes for the user to accept; they MUST NOT silently modify a plan.
- External data MUST be cached and labeled with its source and fetch time where shown
  (e.g. "Forecast as of 09:00").

Rationale: third-party APIs change, cost money, and fail; the user's plan must not.

### V. Simplicity & Verified Changes

- Build the minimum that satisfies the current spec. No speculative features, abstractions,
  or configuration (YAGNI). Principles III and IV are the only standing exceptions.
- Core domain logic MUST have automated tests; each bug fix MUST include a test that reproduces
  it.
- Any added complexity MUST be justified in the plan's Complexity Tracking section.

Rationale: a small, tested codebase is easier to port and extend.

## Technology & Integration Constraints

- The technology stack is chosen per feature plan, but it MUST satisfy Principle III (a portable
  core reusable by a future mobile app).
- Each new third-party service MUST be documented in its plan with: purpose, adapter
  interface, cost/quota limits, and fallback behavior when unavailable.
- Location data MUST only be requested when a feature needs it, and only with the user's
  permission.
- User trip data MUST NOT be sent to AI or third-party services beyond what the feature in use
  requires.

## Development Workflow

- Work follows the Spec Kit flow: specify → (clarify) → plan → tasks → implement.
- Every plan MUST include a Constitution Check against Principles I–V before design begins
  and again after design.
- Changes MUST be small and traceable to a spec or task; unrelated refactors go in separate
  changes.
- Automated tests MUST pass before a change is merged.

## Governance

- This constitution supersedes other project practices. Where it conflicts with a plan, spec,
  or task, the constitution wins until amended.
- Amendments are made via `/speckit-constitution`, recorded with a Sync Impact Report, and
  committed with a message stating the new version.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR
  for adding a principle/section or materially expanding guidance, PATCH for clarifications.
- Compliance is checked in every plan's Constitution Check and during review; violations MUST
  be fixed or explicitly justified in Complexity Tracking.
- Runtime development guidance for AI agents lives in `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12

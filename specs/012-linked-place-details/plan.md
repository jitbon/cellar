# Implementation Plan: Details for Linked Places

**Branch**: `feature/012-linked-place-details` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-linked-place-details/spec.md`

## Summary

Linked list items (name click or "View details") and linked schedule events ("View details" in the
menu) open the same detail view as Popular cards. Stored facts show at once; photo, type, rating,
review count, opening hours and website come from the place provider when the view opens and are
kept for the session only. Popular's view gains hours and website too.

Technical approach: a new `info` action in the existing `places` function makes one Place Details
request by place id ([research.md](./research.md) R1–R2). A `PlaceSearch.info` port method, a
session-cached `usePlaceInfo` hook (R4), and a pure core `openingHours` function for today's line
and the week in the place's time zone (R3). `PlaceDetail` is generalized to take either source
(R5); entry points are added to `ItemPanel` rows and `PlacementChip` menus (R6).

## Technical Context

**Language/Version**: TypeScript 5.x (strict); Deno for the Edge Function

**Primary Dependencies**: Existing Google Places API (New) via the `places` Edge Function; no new
packages or services

**Storage**: None new; session memory only (provider terms)

**Testing**: Vitest (core hours table, web hook and components), Vitest db suite (function handler),
Playwright (places mocked)

**Target Platform**: Evergreen desktop and mobile browsers; Supabase Edge Functions

**Project Type**: Web application (existing monorepo)

**Performance Goals**: Stored facts at once; fetched details within 2 s (FR-005); one request per
place per session (SC-003)

**Constraints**: Only the place id leaves the app (FR-008); WCAG 2.1 AA; 360 px; tokens only;
Enterprise-priced request kept behind a daily quota cap (R2)

**Scale/Scope**: One function action, one port method, one hook, one core module, one generalized
component, two entry points

## Constitution Check

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Read-only view; Place in a block / Edit event reuse existing flows; nothing blocks editing | ✅ | ✅ |
| II. Clean, friendly interface | Same view everywhere; hours and status as text; disclosure button with `aria-expanded`; tokens; 360 px; keyboard | ✅ | ✅ |
| III. Portable core | `PlaceInfo` types and `openingHours` in `packages/core`; UI uses the `PlaceSearch` port | ✅ | ✅ |
| IV. Integrations behind adapters | Google reached only through the `places` function and `SupabasePlaceSearch`; failure → stored facts + note (US3); key stays server-side; data cached in memory and labeled with its source as in Popular | ✅ | ✅ |
| V. Simplicity & verified changes | Extends existing function, adapter, hook pattern and view; table-tested hours logic; no new services or storage | ✅ | ✅ |

**Third-party service use (Technology & Integration Constraints)**

| Service | Purpose | Adapter | When unavailable | Data sent |
|---|---|---|---|---|
| Google Places API (New), Place Details | Photo, type, rating, hours, website for a known place | `places` function `info` → `SupabasePlaceSearch.info` | Stored facts with "More details aren't available right now." | The place id only |

No violations.

## Project Structure

```text
specs/012-linked-place-details/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/places-info.md
└── checklists/requirements.md

supabase/functions/places/handler.ts          # + info action
supabase/tests/places-handler.test.ts         # + info cases
packages/core/src/model/types.ts              # PlaceInfo, WeeklyHours, DayTime, HoursLine, OpeningHours
packages/core/src/ports.ts                    # PlaceSearch.info
packages/core/src/places/hours.ts             # NEW openingHours
packages/core/src/index.ts                    # exports
packages/core/tests/opening-hours.test.ts     # NEW
apps/web/src/adapters/supabasePlaceSearch.ts  # info()
apps/web/src/state/usePlaceInfo.ts            # NEW session cache hook
apps/web/src/components/list/PlaceDetail.tsx (+ .module.css)   # generalized subject, hours, website, notes
apps/web/src/components/list/PopularCard.tsx  # pass subject/actions
apps/web/src/components/list/ItemPanel.tsx    # name button + View details
apps/web/src/components/grid/PlacementChip.tsx # View details in menu
apps/web/tests/                               # usePlaceInfo, PlaceDetail, ItemPanel, PlacementChip cases; fake PlaceSearch gains info
apps/web/e2e/helpers.ts                       # mockPlaces handles info (ok / fail / not-found)
apps/web/e2e/places.spec.ts, photos.spec.ts, a11y.spec.ts   # scenarios
README.md                                     # Place Details cap 300 → ~100/day, with the reason
```

## Complexity Tracking

No constitution violations to justify.

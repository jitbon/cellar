# Implementation Plan: Trip Photos

**Branch**: `feature/007-trip-photos` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-trip-photos/spec.md`

## Summary

Trip cards get a city cover photo with a credit and a status pill; the traveler can pick another
photo of the city. The trip page gets a hideable faded city banner and a "Today" highlight.
Popular cards get small place photos loaded only when in view, and clicking a card opens a
detail dialog with a large photo, details, where it is planned, and its actions.

Technical approach: city photos come from Wikimedia's public API in the browser behind a new
`CityPhotoService` port, cached per device for 7 days ([research.md](./research.md) R1). Place
photos come from Google via the existing `places` Edge Function: photo names ride along in the
Popular Text Search (already Enterprise tier), and a new `photo` action returns a keyless
short-lived image URL (R2). One nullable `trips.cover_photo` column stores a chosen cover (R4).
Status, today and "planned where" are pure core queries.

## Technical Context

**Language/Version**: TypeScript 5.x (strict); Deno for the Edge Function (unchanged)

**Primary Dependencies**: Unchanged. External services: Wikimedia MediaWiki API (free, keyless,
browser), Google Places Photos (via the existing relay). No new npm packages.

**Storage**: `trips.cover_photo` (migration 0009). City photo metadata in `localStorage` (7 days).
Place photo names and URLs in memory only.

**Testing**: Vitest (core, web, edge handler, DB), Playwright with Wikimedia and `places` mocked

**Target Platform**: Evergreen desktop and mobile browsers

**Project Type**: Web application (existing monorepo)

**Performance Goals**: Trip photos within 2 s (SC-001); Popular requests photos only for visible
cards (SC-003); no layout shift (space reserved, FR-010)

**Constraints**: Key server-side only; only city name / photo name sent (FR-009); credits per CC
and Google terms; no storing Google photo names or URLs; WCAG AA (text over photos via overlay);
360 px; tokens only

**Scale/Scope**: Personal use; ~8 place photos per Popular visit; ~6 new UI pieces (trip card
photo + pill, cover picker, banner, today header, thumbnail, detail dialog)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Photos never block or change planning; the detail dialog only offers existing actions; cover choice is one undoable command | ✅ | ✅ |
| II. Clean, friendly interface | Overlay keeps text over photos at AA contrast; "Today" and status are text, not color; credits visible; new sizes and overlay colors added as tokens; reduced motion respected | ✅ | ✅ |
| III. Portable core | Status, today, cover command and queries in `packages/core`; network behind `CityPhotoService` and `PlaceSearch` ports | ✅ | ✅ |
| IV. Integrations behind adapters | Wikimedia only in `wikimediaCityPhotos.ts`; Google only in the Edge Function; every photo has a placeholder fallback; city photos cached and credited; Google photos not stored (terms); cost and quota documented (R2) | ✅ | ✅ |
| V. Simplicity & verified changes | One nullable column; no image proxy; no new deps; tests per R8 | ✅ | ✅ |
| Constraints: data minimization | Only city names and photo names leave the app | ✅ | ✅ |
| Workflow | specify → clarify (2 Qs) → plan; on feature branch | ✅ | ✅ |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-trip-photos/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/ (core.md, database.md, places-function.md)
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/core/src/
├── model/types.ts                 # Trip.coverPhoto, CityPhoto, PlacePhotoRef, TripStatus
├── ports.ts                       # CityPhotoService; PlaceSearch.photoUrl
├── commands/trip.ts               # setTripCoverPhoto
├── commands/location.ts           # setTripLocation clears coverPhoto on change
├── queries/status.ts              # NEW tripToday, tripStatus, tripStatusLabel
└── queries/placed.ts              # + placementsOfPlace

apps/web/src/
├── adapters/wikimediaCityPhotos.ts          # NEW CityPhotoService (fetch + KeyValueStore cache)
├── adapters/supabasePlaceSearch.ts          # + photoUrl; popular maps photo refs
├── state/services.tsx, main.tsx             # + cityPhotos
├── state/useCityPhoto.ts                    # NEW lead or chosen cover for a trip
├── state/usePlacePhoto.ts                   # NEW lazy (IntersectionObserver) + session memory
├── components/photos/PhotoCredit.tsx        # NEW credit line
├── components/photos/CoverPhotoPicker.tsx   # NEW dialog with up to 6 choices
├── components/layout/CityBanner.tsx         # NEW banner (+ hide/show in trip menu)
├── components/list/PlaceDetail.tsx          # NEW detail dialog
├── components/list/PopularCard.tsx          # thumbnail, click/Enter opens detail
├── components/list/PopularTab.tsx           # photo credits footer
├── components/grid/Grid.tsx                 # today header
├── components/ui/Dialog.tsx                 # closeOnBackdrop prop
├── pages/Trips.tsx                          # card photo, pill, card menu
└── styles/tokens.css                        # photo overlay + banner/thumbnail size tokens

supabase/migrations/0009_cover_photo.sql
supabase/functions/places/handler.ts         # popular photos; photo action
supabase/tests/{cover-photo,places-handler}.test.ts
```

**Structure Decision**: Same monorepo layout; photo UI pieces in a new `components/photos/`.

## Complexity Tracking

No constitution violations to justify.

# Implementation Plan: Popular Places Tab

**Branch**: `feature/006-popular-places` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-popular-places/spec.md`

## Summary

The "Activities & food" sidebar gets two tabs: **My list** and **Popular**. Popular shows up to
20 things to do and 20 food places for the trip's city (switchable on multi-city trips), each
with kind, address, rating and review count. Cards drag onto the schedule (or use a menu) to
create an event linked to the real place; dragging doesn't touch the list. Cards in both tabs
show placed state as a strikethrough instead of a count and stay draggable. The list's search
box becomes a quick-add line that also narrows the list as you type.

Technical approach: a new `popular` action on feature 004's `places` Edge Function runs Google
Text Search ("top tourist attractions in X" / "best restaurants in X"). Results live in memory
for the session only, because Google's terms don't allow storing place details
([research.md](./research.md) R3). Core gains derived "placed" queries, `tripCities`, and a
`placePlace` command. No database changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict); Deno for the Edge Function (unchanged)

**Primary Dependencies**: Unchanged (React 19, Vite, supabase-js, dnd-kit, lucide-react). External
service: Google Places API (New) Text Search, via the existing `places` function. No new npm
packages.

**Storage**: None new. Popular lists in browser memory per session; used places stored as
feature 004 linked items/events.

**Testing**: Vitest (core, web, edge handler), Playwright (places function mocked)

**Target Platform**: Evergreen desktop and mobile browsers

**Project Type**: Web application (existing monorepo: `packages/core`, `apps/web`, `supabase`)

**Performance Goals**: Popular results ≤ 2 s for a new city; instant for a loaded city (SC-002);
two requests per city per session

**Constraints**: Key server-side only; only city name + location sent (FR-012); no storage of
place details (Google terms); WCAG 2.1 AA; 360 px; tokens only

**Scale/Scope**: Personal use; ≤ 40 cards per city; ~5 new UI pieces (tabs, Popular tab, popular
card, quick-add line, strikethrough style)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Popular cards and placed cards drag into any cell, any number of times; strikethrough never blocks dragging; every new action is one undo step | ✅ | ✅ |
| II. Clean, friendly interface | Placed state = strikethrough + hidden "placed" text (not color or line alone); tabs follow the ARIA tabs pattern; tokens only; 360 px and axe in quickstart | ✅ | ✅ |
| III. Portable core | Placed queries, `tripCities`, `placePlace`, conversions in `packages/core`; network only behind the `PlaceSearch` port | ✅ | ✅ |
| IV. Integrations behind adapters | Google only in the Edge Function; failures → "Popular places unavailable right now", planning unaffected; cached in memory and labeled "Popular on Google · HH:MM"; cost/quota/fallback in R2 | ✅ | ✅ |
| V. Simplicity & verified changes | No DB changes, no server cache, no new deps; core and handler tests (R10) | ✅ | ✅ |
| Constraints: data minimization | Only city name + coordinates sent; no device location | ✅ | ✅ |
| Workflow | specify → clarify (2 Qs) → plan; on feature branch | ✅ | ✅ |

No violations. Post-design note: the spec's 7-day reuse was changed to session-only (FR-010,
SC-002) to respect Google's caching terms; recorded in the spec. Research also flags a
follow-up for feature 004's stored place details.

## Project Structure

### Documentation (this feature)

```text
specs/006-popular-places/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core.md
│   └── places-function.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/core/src/
├── model/types.ts               # + PopularPlace, PopularList
├── ports.ts                     # PlaceSearch + popular(city)
├── places/popular.ts            # NEW popularToPlace
├── queries/placed.ts            # NEW isItemPlaced, isPlacePlaced
├── queries/location.ts          # + tripCities
├── queries/items.ts             # + matchesItemName
├── commands/placement.ts        # + placePlace
└── index.ts

apps/web/src/
├── adapters/supabasePlaceSearch.ts      # + popular(): two group requests, dedupe
├── state/usePopularPlaces.ts            # NEW session cache per city, status
├── components/list/ItemPanel.tsx        # tabs; quick-add line; strikethrough on items
├── components/list/QuickAddLine.tsx     # NEW combobox: filter + add + place suggestions
├── components/list/PopularTab.tsx       # NEW city selector, groups, states, attribution
├── components/list/PopularCard.tsx      # NEW draggable card + menu
├── components/grid/DndProvider.tsx      # handle `popular:` drops
├── components/grid/DragLayer.tsx        # preview for popular cards
└── components/grid/dndIds.ts            # + popular prefix

supabase/functions/places/handler.ts     # + popular action
supabase/tests/places-handler.test.ts    # + popular tests
```

**Structure Decision**: Same monorepo layout; the Popular UI lives with the existing list
components in `components/list/`.

## Complexity Tracking

No constitution violations to justify.

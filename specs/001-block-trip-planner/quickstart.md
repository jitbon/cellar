# Quickstart & Validation: Block-Based Trip Planner (Core)

How to run the feature locally and prove it meets the [spec](./spec.md).

## Prerequisites

- Node.js 22 LTS and pnpm 9
- Docker (for local Supabase)
- Supabase CLI

## Setup

```bash
pnpm install
supabase start                 # local Postgres, Auth, Realtime; prints URL + anon key
supabase db reset              # applies supabase/migrations
cp apps/web/.env.example apps/web/.env.local   # set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
pnpm --filter web dev          # http://localhost:5173
```

Local auth emails (confirmation, password reset) appear in Inbucket at the URL printed by
`supabase start`.

## Automated checks

```bash
pnpm --filter @cellar/core test     # unit tests for all commands/queries (contracts/core.md)
pnpm test:db                        # RLS, constraints, RPCs against local Supabase
pnpm --filter web test              # component + adapter tests
pnpm --filter web e2e               # Playwright: scenarios below + 360px + keyboard-only
pnpm lint                           # includes the design-token stylelint rule
```

All must pass before merge (constitution, Development Workflow).

## Manual validation scenarios

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Sign up, confirm email, sign in | Empty trip list | US1-4 |
| 2 | Create "Tokyo" 2027-04-01 → 2027-04-05 | 5 day columns with weekdays, 10 default blocks; done in < 1 min | US1-1, SC-001 |
| 3 | Type "Walk around Shibuya" in Day 2 / Afternoon, Enter, type "Coffee" | Two Activity placements in that cell; list unchanged | US1-2, US1-6 |
| 4 | Switch "Coffee" to Food place | Icon + label change | US1-7 |
| 5 | Add "Ichiran Ramen" (Food) to list; type "ichi" in Day 3 / Lunch, choose suggestion | Copy placed with notes/link; list shows "placed 1×" | US1-8, FR-007a |
| 6 | Drag same item into Day 1 / Breakfast; edit that copy's notes | Two copies; only Day 1 copy changed | US2-3, US2-4 |
| 7 | Delete "Ichiran Ramen" from the list | Both placements copied from it remain | US2-5 |
| 8 | Add block "Tea" after Afternoon; rename, reorder, remove an empty block | Grid updates on every day | US3-1..3 |
| 9 | Set Day 1 arrival = Lunch; last day departure = Afternoon | Correct cells greyed; can still drop into them | US3-4, US3-5 |
| 10 | Undo the last 3 actions, redo 1 | Exact prior states restored | US4-1, SC-004 |
| 11 | Shorten trip by a day with placements on it | Warning with count; cancel keeps everything | US4-2 |
| 12 | Open the trip in a second browser profile, edit in one | Change appears in the other within 5 s | US1-5, SC-007 |
| 13 | Go offline (devtools), make an edit | "Not saved — retrying" banner; edit saves on reconnect | FR-020 |
| 14 | Repeat 2–6 at 360px width, keyboard only | All tasks completable | SC-006 |
| 15 | Delete account; sign back in | "Deletion cancelled" message; trips intact | FR-018a |
| 16 | Second account opens first account's trip URL | Not found / no data | FR-018 |
| 17 | Delete a trip, press Undo; delete it again, restore from "Recently deleted" | Trip returns intact both times | FR-002 |

Purge after 30 days is verified by `pnpm test:db` (backdated `deleted_at` /
`deletion_requested_at`, run `purge_expired_deletions()`, assert trips / users are gone).

# Quickstart: Details for Linked Places

## Automated checks

```sh
pnpm lint && pnpm --filter web typecheck && pnpm test
# db/function tests (env vars as in earlier features):
pnpm test:db
# from apps/web with the usual env vars; places are mocked, no Google key needed:
pnpm exec playwright test e2e/places.spec.ts e2e/photos.spec.ts e2e/a11y.spec.ts
```

## Live check (real Google key in `supabase/functions/.env`, `places` function served)

1. **List item (US1)**: in a New York trip, add "Chelsea Market" to My list by picking the
   suggestion. Click its name → the view shows photo with credit, "Market · 75 9th Ave…",
   ★ rating (count), today's hours, "Show week", Website, "Not planned yet", Place in a block and
   Open in maps.
2. **Planned dates**: place it on two days; reopen → both dates listed.
3. **Event (US2)**: on the schedule, open the event's menu → View details → same view with Edit
   event; clicking the event itself still opens edit.
4. **Popular**: open a Popular card → hours and website now appear too.
5. **Session cache (SC-003)**: reopen the same place → details at once; DevTools Network shows no
   new `places` `info` request.
6. **Unavailable (US3)**: stop the places function (or go offline) and open details for a place
   not yet opened → name, address, planned dates and Open in maps show with "More details aren't
   available right now."
7. **Time zone**: from a browser in another time zone, a Tokyo place's "today" follows Tokyo.
8. **Unlinked**: an item typed without picking a suggestion has no View details.

## Google Cloud

Lower the existing Place Details daily cap (README: 300/day) to about 100/day: it is shared with
autocomplete picks, and each first opening of a place in a session is now one Place Details
Enterprise request.

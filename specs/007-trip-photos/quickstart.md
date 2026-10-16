# Quickstart: Trip Photos

Contracts: [core](./contracts/core.md), [database](./contracts/database.md),
[places function](./contracts/places-function.md). Data: [data-model.md](./data-model.md).

## Prerequisites

- Local Supabase running with `0009_cover_photo.sql` applied (`supabase migration up --local`;
  no reset needed).
- `places` function served with the Google key (features 004/006), restarted to pick up the
  `photo` action.
- Google Cloud: daily quota cap on Place Photos (~60/day) (research R2).
- Trips located in Kyoto, New York and Lisbon, plus one without a location.

## Automated checks

```sh
pnpm lint && pnpm --filter web typecheck
pnpm test
pnpm test:db             # cover_photo constraint + places handler tests
pnpm --filter web e2e    # Wikimedia and places mocked; never calls Google or Wikimedia
```

## Manual scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Open "Your trips" | Kyoto, NYC, Lisbon cards show city photos with "Photo: … · CC …" credits and status pills; the unlocated trip shows the placeholder and "Set a location to get a cover photo" |
| 2 | Kyoto card menu → Change cover photo | Up to 6 Kyoto photos with credits; pick one → card updates; Undo restores |
| 3 | Same menu → Use automatic photo | Back to the lead photo |
| 4 | Change the Kyoto trip's location to Osaka | Card shows Osaka's lead photo (choice cleared) |
| 5 | Open the NYC trip | Banner with photo, "New York, USA", progress text, credit; today's header says "Today" when in range |
| 6 | Trip menu → Hide city banner → reload | Banner stays hidden; Show city banner brings it back |
| 7 | Popular tab | First ~6–8 cards show photos; scrolling loads more; footer lists "Photos: …" |
| 8 | Click "The Met" card | Detail view: big photo with credit, details, "Planned:" lines, three actions; X, Esc, backdrop close it |
| 9 | Drag a Popular card to a cell | Event placed; detail view does not open |
| 10 | Stop the places function; block Wikimedia | All photos show placeholders; everything else works |
| 11 | 360 px, dark mode, keyboard only | Banner shorter; credits readable; detail opens with Enter; axe clean |

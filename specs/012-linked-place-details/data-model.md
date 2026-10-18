# Data Model: Details for Linked Places

No stored data changes: no migrations, no new fields on items or events. Linked items and events
keep the `Place` they already store (`id` = provider place id, `name`, `address`, `lat`, `lon`,
`category`).

## Core types (`packages/core`)

```text
PlaceInfo                      # session memory only (FR-006)
  placeId: string
  name: string
  kind: string                 # primaryTypeDisplayName, may be ''
  types: string[]
  rating: number | null
  ratingCount: number | null
  photo: PlacePhotoRef | null  # existing type (name expires; never stored)
  hours: WeeklyHours | null    # null when the provider has none
  utcOffsetMinutes: number | null
  website: string | null       # only http(s) URLs kept

WeeklyHours
  periods: { open: DayTime, close: DayTime | null }[]
DayTime
  day: 0..6                    # Sunday = 0 (provider convention)
  hour: 0..23
  minute: 0..59

HoursLine                      # output of openingHours()
  day: 0..6
  kind: 'closed' | 'open-24h' | 'open'
  ranges: { openMin: number, closeMin: number }[]   # minutes since local midnight; closeMin may exceed 1440 for past-midnight closing

OpeningHours
  today: HoursLine             # the place's local day
  week: HoursLine[]            # 7 lines, Monday first
```

`PlaceSearch.info(placeId)` rejects with an error whose `code` is `'not-found'` when the provider
no longer knows the place; any other rejection means unavailable.

## Session cache (web)

`WeakMap<PlaceSearch, Map<placeId, PlaceInfo | 'not-found'>>` and a pending map; cleared on page
reload. Failures are not kept.

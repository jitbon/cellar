# Data Model: Weather Forecast on the Schedule

Extends [001 data-model](../001-block-trip-planner/data-model.md). Only additions and changed
rules are listed. Persisted fields sync, merge, and undo exactly like existing trip data.

## Persisted (Supabase, migration `0006_weather.sql`)

### Location (value object, stored as four flat columns)

| Field (domain / column) | Type | Rules |
|---|---|---|
| `name` / `*_location_name` | text | 1–120 chars, e.g. "Kyoto, Japan" |
| `lat` / `*_location_lat` | double | −90…90 |
| `lon` / `*_location_lon` | double | −180…180 |
| `tz` / `*_location_tz` | text | IANA zone from the geocoder, e.g. "Asia/Tokyo" |

All four are null or all four are set (check constraint on each table).

Domain rows keep the four fields flat (`locationName`, …); core queries read them as one
`Location | null` value — see [contracts/core.md](./contracts/core.md).

### Trip (changed)

| New column | Type | Notes |
|---|---|---|
| `location_name`, `location_lat`, `location_lon`, `location_tz` | as above, nullable | Trip location (FR-001). Null = no location → no weather (FR-003). |

### DaySetting (changed)

| New column | Type | Notes |
|---|---|---|
| `location_name`, `location_lat`, `location_lon`, `location_tz` | as above, nullable | Per-day override (FR-001a). Null = use trip location. |

**Row lifecycle (changed, research R4)**: a row exists while `arrival_block_id`,
`departure_block_id`, or the location override is set; it is deleted when all are cleared.
Applies to `setDayWindow`, `setDayLocation`, and `removeBlock`'s cleanup. Shrinking trip dates
removes rows outside the range (unchanged).

### Block (changed)

| New column | Type | Rules |
|---|---|---|
| `window_start_min` | int, nullable | 0–1439 |
| `window_end_min` | int, nullable | 0–1439; ≠ start; end < start = crosses midnight |

Both null or both set. Null only for blocks created before this feature (research R5).

**Default windows** (written by `createTrip`, also used for legacy blocks by name):

| Block | Window |
|---|---|
| Morning | 06:00–08:00 |
| Breakfast | 08:00–10:00 |
| Late morning | 10:00–12:00 |
| Lunch | 12:00–14:00 |
| Afternoon | 14:00–16:00 |
| Late afternoon | 16:00–18:00 |
| Dinner | 18:00–20:00 |
| Dessert | 20:00–21:00 |
| Evening | 21:00–23:00 |
| Night | 23:00–02:00 |

**Suggested window** (new block via `addBlock`, and legacy custom blocks): start = previous
block's effective end (06:00 if first), end = start + 60 min (mod 1440).

## Derived (core, not persisted)

### Effective location for a day

`daySetting.location ?? trip.location ?? null`.

### Effective block window

`block.window ?? defaultWindowByName(block.name) ?? suggestedWindow(position)`.

### Forecast (cached per device, never synced)

| Field | Type | Notes |
|---|---|---|
| `key` | string | `lat.toFixed(2),lon.toFixed(2),tz` |
| `tz` | string | Location time zone |
| `hours` | `{ time: 'YYYY-MM-DDTHH:00'; code: number; tempC: number; rainPct: number \| null }[]` | Local time, hourly, 16 days |
| `fetchedAt` | ISO timestamp | Shown as "Forecast as of HH:MM"; stale after 3 h |

### Cell weather (output of `summarizeWindow`)

| Field | Type |
|---|---|
| `condition` | `'clear' \| 'partly-cloudy' \| 'cloudy' \| 'fog' \| 'rain' \| 'snow' \| 'thunderstorm'` |
| `tempC` | number (rounded mean) |
| `rainPct` | number \| null (max) |
| `fetchedAt` | ISO timestamp |

### Day forecast status

| Status | Meaning | UI |
|---|---|---|
| `no-location` | No effective location | No icons; trip-level "Add a location" prompt |
| `past` | Date before today (location tz) | No icons |
| `pending` | After today + 15 | Day header: "Forecast from <date − 15>" |
| `in-range` | Within forecast window | Icons per cell (or none if data missing) |
| `unavailable` | In range, fetch failed, no cache | No icons; one grid banner "Weather unavailable" |

## Validation summary

- Location: all-or-nothing; name trimmed 1–120; lat/lon in range; tz non-empty.
- Block window: integers 0–1439, start ≠ end, both or neither.
- `setDayLocation` date must be within the trip (same rule as `setDayWindow`).

# Contract: Supabase database changes

Migration `supabase/migrations/0006_weather.sql`. Extends
[001 contracts/database.md](../../001-block-trip-planner/contracts/database.md); RLS policies,
realtime publication, and triggers are unchanged and cover the new columns automatically.

## Columns

```text
trips         + location_name text null, location_lat double precision null,
                location_lon double precision null, location_tz text null
day_settings  + location_name text null, location_lat double precision null,
                location_lon double precision null, location_tz text null
blocks        + window_start_min integer null, window_end_min integer null
```

## Constraints

| Table | Constraint |
|---|---|
| trips, day_settings | `location_*` all null or all non-null |
| trips, day_settings | `char_length(btrim(location_name)) between 1 and 120`; lat in [−90, 90]; lon in [−180, 180]; `char_length(location_tz) > 0` |
| blocks | `window_*` both null or both non-null; each in [0, 1439]; `window_start_min <> window_end_min` |

## Behavior the client relies on

- No backfill: existing rows get nulls; core derives effective windows (research R5).
- No weather or forecast data is stored server-side.
- Weather data never leaves the device except the coordinates/search text sent to Open-Meteo
  (FR-012); nothing about this feature is sent to Supabase beyond the columns above.

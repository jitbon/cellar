# Contract: Supabase database

Tables, columns, and rules follow [data-model.md](../data-model.md). This file lists what the
client may rely on.

## Tables

`profiles`, `trips`, `blocks`, `day_settings`, `items`, `placements`.

- All have `updated_at` set by a `before update/insert` trigger to `now()`.
- `trips`, `blocks`, `day_settings`, `items`, `placements` are in the `supabase_realtime`
  publication. INSERT/UPDATE subscriptions filter by `trip_id`; DELETE events are unfiltered and
  carry only the primary key (research R5).
- `trips.deleted_at` marks a soft-deleted trip; no unique constraint on any `position` column.
- `placement_type` enum: `activity`, `food`.

## Row-level security (all tables, RLS enabled)

| Table | select / insert / update / delete allowed when |
|---|---|
| profiles | `id = auth.uid()` (select, update only) |
| trips | `owner_id = auth.uid()` |
| blocks, day_settings, items, placements | `exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid())` |

Insert/update on child tables also require that any referenced `block_id`, `source_item_id`,
`arrival_block_id`, `departure_block_id` belong to the same `trip_id` (check via trigger).

## Constraints enforced server-side

- `trips.end_date >= start_date`, span ≤ 60 days.
- Non-empty trimmed `name` on trips, blocks, items, placements.
- Trigger rejects deleting the last block of a trip.
- `day_settings`, `placements` `date` within the trip's range (trigger).

## RPCs (`security definer`, callable by authenticated users only)

| Function | Effect | Returns |
|---|---|---|
| `request_account_deletion()` | Sets `profiles.deletion_requested_at = now()` for `auth.uid()` | void |
| `cancel_account_deletion()` | Clears it for `auth.uid()` | `boolean` — true if a pending deletion was cancelled |

## Scheduled job

`pg_cron`, daily, runs `purge_expired_deletions()`, which:
- `delete from trips where deleted_at < now() - interval '30 days'`
- `delete from auth.users where id in (select id from profiles where deletion_requested_at <
  now() - interval '30 days')`

Cascades remove all owned data.

## Keys

Client uses only the project URL and anon key. Service-role key is used only by migrations/CI,
never shipped.

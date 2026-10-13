-- Row-level security (contracts/database.md)

alter table profiles enable row level security;
alter table trips enable row level security;
alter table blocks enable row level security;
alter table day_settings enable row level security;
alter table items enable row level security;
alter table placements enable row level security;

create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy trips_all on trips for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy blocks_all on blocks for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy day_settings_all on day_settings for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy items_all on items for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy placements_all on placements for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()));

alter publication supabase_realtime add table trips, blocks, day_settings, items, placements;

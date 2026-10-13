-- updated_at, profile creation, and cross-row integrity rules

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before insert or update on profiles
  for each row execute function set_updated_at();
create trigger trips_updated_at before insert or update on trips
  for each row execute function set_updated_at();
create trigger blocks_updated_at before insert or update on blocks
  for each row execute function set_updated_at();
create trigger day_settings_updated_at before insert or update on day_settings
  for each row execute function set_updated_at();
create trigger items_updated_at before insert or update on items
  for each row execute function set_updated_at();
create trigger placements_updated_at before insert or update on placements
  for each row execute function set_updated_at();

create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- A trip always keeps at least one block. Deleting the whole trip cascades; allow that.
create function reject_last_block_delete() returns trigger language plpgsql as $$
begin
  if exists (select 1 from trips where id = old.trip_id)
     and not exists (select 1 from blocks where trip_id = old.trip_id and id <> old.id) then
    raise exception 'A trip must keep at least one block' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger blocks_keep_one before delete on blocks
  for each row execute function reject_last_block_delete();

-- Dates must fall inside the trip's range.
create function check_date_in_trip_range() returns trigger language plpgsql as $$
declare
  t trips%rowtype;
begin
  select * into t from trips where id = new.trip_id;
  if not found then
    return new;
  end if;
  if new.date < t.start_date or new.date > t.end_date then
    raise exception 'Date % is outside the trip range', new.date using errcode = '23514';
  end if;
  return new;
end $$;

create trigger placements_date_range before insert or update on placements
  for each row execute function check_date_in_trip_range();
create trigger day_settings_date_range before insert or update on day_settings
  for each row execute function check_date_in_trip_range();

-- Referenced rows must belong to the same trip.
create function check_same_trip() returns trigger language plpgsql as $$
declare
  ref uuid;
begin
  if tg_table_name = 'placements' then
    if new.block_id is not null
       and not exists (select 1 from blocks where id = new.block_id and trip_id = new.trip_id) then
      raise exception 'block_id belongs to a different trip' using errcode = '23514';
    end if;
    if new.source_item_id is not null
       and not exists (select 1 from items where id = new.source_item_id and trip_id = new.trip_id) then
      raise exception 'source_item_id belongs to a different trip' using errcode = '23514';
    end if;
  else
    foreach ref in array array[new.arrival_block_id, new.departure_block_id] loop
      if ref is not null
         and not exists (select 1 from blocks where id = ref and trip_id = new.trip_id) then
        raise exception 'block belongs to a different trip' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end $$;

create trigger placements_same_trip before insert or update on placements
  for each row execute function check_same_trip();
create trigger day_settings_same_trip before insert or update on day_settings
  for each row execute function check_same_trip();

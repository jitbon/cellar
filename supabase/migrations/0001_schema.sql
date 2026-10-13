-- Schema for the block-based trip planner (data-model.md)

create type placement_type as enum ('activity', 'food');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  deletion_requested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trips (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint trips_range_check check (end_date >= start_date and end_date - start_date <= 59)
);
create index trips_owner_idx on trips (owner_id);

create table blocks (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  position text not null,
  updated_at timestamptz not null default now(),
  constraint blocks_name_check check (char_length(btrim(name)) between 1 and 40)
);
create index blocks_trip_idx on blocks (trip_id);

create table day_settings (
  trip_id uuid not null references trips (id) on delete cascade,
  date date not null,
  arrival_block_id uuid null references blocks (id) on delete set null,
  departure_block_id uuid null references blocks (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, date)
);

create table items (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  type placement_type not null,
  notes text null,
  link text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint items_notes_check check (notes is null or char_length(notes) <= 5000),
  constraint items_link_check check (link is null or link ~* '^https?://')
);
create index items_trip_idx on items (trip_id);

create table placements (
  id uuid primary key,
  trip_id uuid not null references trips (id) on delete cascade,
  date date not null,
  block_id uuid not null references blocks (id) on delete cascade,
  position text not null,
  name text not null,
  type placement_type not null default 'activity',
  notes text null,
  link text null,
  source_item_id uuid null references items (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint placements_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint placements_notes_check check (notes is null or char_length(notes) <= 5000),
  constraint placements_link_check check (link is null or link ~* '^https?://')
);
create index placements_cell_idx on placements (trip_id, date, block_id);

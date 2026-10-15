-- Map locations: a saved place snapshot on items and placements (contracts/database.md)

alter table items
  add column place_id text null,
  add column place_provider text null,
  add column place_name text null,
  add column place_address text null,
  add column place_lat double precision null,
  add column place_lon double precision null,
  add column place_category text null,
  add constraint items_place_all_or_none check (
    (place_id is null and place_provider is null and place_name is null
       and place_address is null and place_lat is null and place_lon is null
       and place_category is null)
    or (place_id is not null and place_provider is not null and place_name is not null
        and place_address is not null and place_lat is not null and place_lon is not null)
  ),
  add constraint items_place_check check (
    place_id is null or (
      char_length(place_id) between 1 and 300
      and place_provider = 'google'
      and char_length(btrim(place_name)) between 1 and 200
      and char_length(place_address) <= 300
      and place_lat between -90 and 90
      and place_lon between -180 and 180
      and (place_category is null or char_length(place_category) <= 100)
    )
  );

alter table placements
  add column place_id text null,
  add column place_provider text null,
  add column place_name text null,
  add column place_address text null,
  add column place_lat double precision null,
  add column place_lon double precision null,
  add column place_category text null,
  add constraint placements_place_all_or_none check (
    (place_id is null and place_provider is null and place_name is null
       and place_address is null and place_lat is null and place_lon is null
       and place_category is null)
    or (place_id is not null and place_provider is not null and place_name is not null
        and place_address is not null and place_lat is not null and place_lon is not null)
  ),
  add constraint placements_place_check check (
    place_id is null or (
      char_length(place_id) between 1 and 300
      and place_provider = 'google'
      and char_length(btrim(place_name)) between 1 and 200
      and char_length(place_address) <= 300
      and place_lat between -90 and 90
      and place_lon between -180 and 180
      and (place_category is null or char_length(place_category) <= 100)
    )
  );

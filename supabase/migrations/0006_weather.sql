-- Weather forecast: trip and per-day locations, and block time windows (contracts/database.md)

alter table trips
  add column location_name text null,
  add column location_lat double precision null,
  add column location_lon double precision null,
  add column location_tz text null,
  add constraint trips_location_all_or_none check (
    (location_name is null and location_lat is null and location_lon is null and location_tz is null)
    or (location_name is not null and location_lat is not null and location_lon is not null
        and location_tz is not null)
  ),
  add constraint trips_location_check check (
    location_name is null or (
      char_length(btrim(location_name)) between 1 and 120
      and location_lat between -90 and 90
      and location_lon between -180 and 180
      and char_length(location_tz) > 0
    )
  );

alter table day_settings
  add column location_name text null,
  add column location_lat double precision null,
  add column location_lon double precision null,
  add column location_tz text null,
  add constraint day_settings_location_all_or_none check (
    (location_name is null and location_lat is null and location_lon is null and location_tz is null)
    or (location_name is not null and location_lat is not null and location_lon is not null
        and location_tz is not null)
  ),
  add constraint day_settings_location_check check (
    location_name is null or (
      char_length(btrim(location_name)) between 1 and 120
      and location_lat between -90 and 90
      and location_lon between -180 and 180
      and char_length(location_tz) > 0
    )
  );

alter table blocks
  add column window_start_min integer null,
  add column window_end_min integer null,
  add constraint blocks_window_both_or_none check (
    (window_start_min is null) = (window_end_min is null)
  ),
  add constraint blocks_window_check check (
    window_start_min is null or (
      window_start_min between 0 and 1439
      and window_end_min between 0 and 1439
      and window_start_min <> window_end_min
    )
  );

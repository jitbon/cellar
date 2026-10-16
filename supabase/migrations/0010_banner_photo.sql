-- Trip page banner photo, chosen separately from the trip card's cover photo.
-- Null follows the automatic city photo. Nullable, no backfill; RLS unchanged.

alter table trips
  add column banner_photo text null,
  add constraint trips_banner_photo_check check (
    banner_photo is null or char_length(banner_photo) between 1 and 300
  );

-- Trip cover photo: the Wikimedia Commons file name the traveler picked; null follows the
-- city's automatic photo. Nullable, so existing trips need no backfill. RLS unchanged.

alter table trips
  add column cover_photo text null,
  add constraint trips_cover_photo_check check (
    cover_photo is null or char_length(cover_photo) between 1 and 300
  );

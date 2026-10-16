# Contract: Database (`supabase/migrations/0009_cover_photo.sql`)

```sql
alter table trips
  add column cover_photo text null,
  add constraint trips_cover_photo_check check (
    cover_photo is null or char_length(cover_photo) between 1 and 300
  );
```

Nullable, no backfill; RLS unchanged. Tests (`supabase/tests/cover-photo.test.ts`): null and a
normal file name accepted; empty string and 301 chars rejected; another user cannot update it.

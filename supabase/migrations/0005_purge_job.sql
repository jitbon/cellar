-- 30-day purge of deleted trips and accounts (FR-002, FR-018a, research R10)

create function purge_expired_deletions() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from trips where deleted_at < now() - interval '30 days';
  delete from auth.users
    where id in (
      select id from profiles where deletion_requested_at < now() - interval '30 days'
    );
end $$;

revoke all on function purge_expired_deletions() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule('purge-expired-deletions', '0 3 * * *', 'select public.purge_expired_deletions()');

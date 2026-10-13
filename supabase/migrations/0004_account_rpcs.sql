-- Account deletion grace period (FR-018a, research R10)

create function request_account_deletion() returns void
  language sql security definer set search_path = public as $$
  update profiles set deletion_requested_at = now() where id = auth.uid();
$$;

create function cancel_account_deletion() returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  was_pending boolean;
begin
  select deletion_requested_at is not null into was_pending
    from profiles where id = auth.uid();
  update profiles set deletion_requested_at = null where id = auth.uid();
  return coalesce(was_pending, false);
end $$;

revoke all on function request_account_deletion() from public, anon;
revoke all on function cancel_account_deletion() from public, anon;
grant execute on function request_account_deletion() to authenticated;
grant execute on function cancel_account_deletion() to authenticated;

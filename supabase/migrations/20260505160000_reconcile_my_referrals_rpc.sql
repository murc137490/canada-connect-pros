-- Inviter dashboards can call reconcile_my_referrals() before listing invites so rows complete
-- if the invitee verified email but the auth trigger missed (ordering, swallowed exception, etc.).

create or replace function public.reconcile_my_referrals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.referral_invites ri set
    invited_user_id = au.id,
    status = 'completed',
    accepted_at = coalesce(ri.accepted_at, now()),
    updated_at = now(),
    reward_code = coalesce(
      nullif(ri.reward_code, 'freetrial'),
      'rwd_' || encode(gen_random_bytes(18), 'hex')
    )
  from auth.users au
  where ri.status = 'pending'
    and ri.invited_user_id is null
    and ri.inviter_user_id = auth.uid()
    and ri.inviter_user_id <> au.id
    and au.email_confirmed_at is not null
    and lower(trim(ri.invitee_email)) = lower(trim(au.email::text))
    and (
      nullif(au.raw_user_meta_data ->> 'referral_code', '') is null
      or ri.referral_code = nullif(au.raw_user_meta_data ->> 'referral_code', '')
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.reconcile_my_referrals() from public;
grant execute on function public.reconcile_my_referrals() to authenticated;

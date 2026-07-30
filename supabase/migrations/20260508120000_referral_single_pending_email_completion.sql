-- Referral completion: stop leaving invites pending when the invitee email is confirmed
-- but user_metadata.referral_code is missing or does not match (browser/session, typos, etc.).
--
-- Complete when:
-- (A) Metadata referral_code matches this row's referral_code (needed when multiple people
--     invited the same email — disambiguate by link), OR
-- (B) There is exactly one pending referral_invites row globally for that email (usual case:
--     one inviter per friend email, so code mismatch should not block completion).

create or replace function public.mark_referral_invite_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  invitee text;
  pending_for_email int;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  invitee := lower(trim(new.email::text));
  if invitee is null or invitee = '' then
    return new;
  end if;

  ref_code := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), '');

  select count(*)::int into pending_for_email
  from public.referral_invites ri0
  where ri0.status = 'pending'
    and ri0.invited_user_id is null
    and lower(trim(ri0.invitee_email)) = invitee;

  begin
    update public.referral_invites
    set
      invited_user_id = new.id,
      status = 'completed',
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now(),
      reward_code = coalesce(
        nullif(reward_code, 'freetrial'),
        'rwd_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
      )
    where status = 'pending'
      and invited_user_id is null
      and inviter_user_id <> new.id
      and lower(trim(invitee_email)) = invitee
      and (
        (ref_code is not null and lower(trim(referral_code)) = ref_code)
        or pending_for_email = 1
      );
  exception
    when others then
      raise warning 'mark_referral_invite_completed skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

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
      'rwd_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    )
  from auth.users au
  cross join lateral (
    select count(*)::int as c
    from public.referral_invites ri2
    where ri2.status = 'pending'
      and ri2.invited_user_id is null
      and lower(trim(ri2.invitee_email)) = lower(trim(au.email::text))
  ) p
  where ri.status = 'pending'
    and ri.invited_user_id is null
    and ri.inviter_user_id = auth.uid()
    and ri.inviter_user_id <> au.id
    and au.email_confirmed_at is not null
    and lower(trim(ri.invitee_email)) = lower(trim(au.email::text))
    and (
      (
        nullif(lower(trim(coalesce(au.raw_user_meta_data ->> 'referral_code', ''))), '') is not null
        and lower(trim(ri.referral_code)) = nullif(lower(trim(coalesce(au.raw_user_meta_data ->> 'referral_code', ''))), '')
      )
      or p.c = 1
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

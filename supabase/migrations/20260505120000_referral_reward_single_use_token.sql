-- One-time reward token per completed referral (replaces shared default 'freetrial').

alter table public.referral_invites
  alter column reward_code drop default;

alter table public.referral_invites
  alter column reward_code drop not null;

create unique index if not exists referral_invites_reward_code_key
  on public.referral_invites (reward_code)
  where reward_code is not null;

update public.referral_invites
set reward_code = null
where status = 'pending';

update public.referral_invites
set reward_code = 'rwd_' || encode(gen_random_bytes(18), 'hex')
where status in ('completed', 'reward_claimed')
  and (reward_code is null or reward_code = 'freetrial');

create or replace function public.mark_referral_invite_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  ref_code := nullif(new.raw_user_meta_data ->> 'referral_code', '');

  update public.referral_invites
  set
    invited_user_id = new.id,
    status = 'completed',
    accepted_at = coalesce(accepted_at, now()),
    updated_at = now(),
    reward_code = coalesce(
      nullif(reward_code, 'freetrial'),
      'rwd_' || encode(gen_random_bytes(18), 'hex')
    )
  where status = 'pending'
    and invited_user_id is null
    and inviter_user_id <> new.id
    and lower(invitee_email) = lower(new.email)
    and (ref_code is null or referral_code = ref_code);

  return new;
end;
$$;

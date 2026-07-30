-- Referral invites: invite a friend, unlock a 14-day Growth coupon once they create an account.

create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users (id) on delete cascade,
  invitee_email text not null,
  invited_user_id uuid references auth.users (id) on delete set null,
  referral_code text not null unique,
  reward_code text not null default 'freetrial',
  reward_days integer not null default 14 check (reward_days = 14),
  status text not null default 'pending' check (status in ('pending', 'completed', 'reward_claimed')),
  accepted_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_invites_no_self_unique unique (inviter_user_id, invitee_email)
);

create index if not exists referral_invites_inviter_idx
  on public.referral_invites (inviter_user_id, status, created_at desc);

create index if not exists referral_invites_invitee_email_idx
  on public.referral_invites (lower(invitee_email), status);

alter table public.referral_invites enable row level security;

drop policy if exists "Users read own referral invites" on public.referral_invites;
create policy "Users read own referral invites"
  on public.referral_invites for select
  to authenticated
  using (inviter_user_id = auth.uid());

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
    updated_at = now()
  where status = 'pending'
    and invited_user_id is null
    and inviter_user_id <> new.id
    and lower(invitee_email) = lower(new.email)
    and (ref_code is null or referral_code = ref_code);

  return new;
end;
$$;

drop trigger if exists on_auth_user_referral_completed_insert on auth.users;
create trigger on_auth_user_referral_completed_insert
  after insert on auth.users
  for each row
  execute function public.mark_referral_invite_completed();

drop trigger if exists on_auth_user_referral_completed_update on auth.users;
create trigger on_auth_user_referral_completed_update
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at)
  execute function public.mark_referral_invite_completed();

revoke all on function public.mark_referral_invite_completed() from public;
grant execute on function public.mark_referral_invite_completed() to service_role;

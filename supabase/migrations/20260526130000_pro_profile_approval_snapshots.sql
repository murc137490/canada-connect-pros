-- Baseline snapshot at first pro application submit; admins compare to live profile while pending.
alter table public.pro_profiles
  add column if not exists approval_baseline_json jsonb,
  add column if not exists profile_last_edited_at timestamptz;

comment on column public.pro_profiles.approval_baseline_json is
  'Frozen JSON snapshot of the application at first submit; used for admin diff until verified.';
comment on column public.pro_profiles.profile_last_edited_at is
  'Last time the pro saved their profile (including while pending approval).';

create or replace function public.accept_pro_by_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'Forbidden: admin only';
  end if;
  if not exists (select 1 from public.pro_subscriptions s where s.user_id = p_user_id) then
    raise exception 'No subscription on file: applicant must complete Pro Plans checkout before approval.';
  end if;
  update public.pro_profiles
  set
    is_verified = true,
    updated_at = now(),
    approval_baseline_json = null,
    profile_last_edited_at = null
  where user_id = p_user_id;
end;
$$;

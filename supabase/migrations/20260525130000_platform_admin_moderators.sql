-- Delegated platform admins (`profiles.is_platform_admin`) + helper for RLS/RPC.
-- Only premiereservicescontact@gmail.com may assign the flag (see grant_platform_admin_by_email).

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  'When true, user may use Premiere admin dashboard tools. Only supreme admin may set this.';

create or replace function public.auth_is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select lower(trim(coalesce(u.email::text, ''))) = 'premiereservicescontact@gmail.com'
     from auth.users u
     where u.id = auth.uid()),
    false
  )
  or coalesce(
    (select p.is_platform_admin
     from public.profiles p
     where p.user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.auth_is_platform_moderator() from public;
grant execute on function public.auth_is_platform_moderator() to authenticated;

-- Prevent users from toggling their own admin flag (supreme uses RPC or table editor as owner).
create or replace function public.profiles_guard_platform_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  supreme boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if coalesce(new.is_platform_admin, false) = coalesce(old.is_platform_admin, false) then
    return new;
  end if;
  select exists(
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email::text, ''))) = 'premiereservicescontact@gmail.com'
  ) into supreme;
  if supreme then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  raise exception 'Platform admin role can only be changed by the supreme admin account.';
end;
$$;

drop trigger if exists trg_profiles_guard_platform_admin on public.profiles;
create trigger trg_profiles_guard_platform_admin
  before update of is_platform_admin on public.profiles
  for each row
  execute function public.profiles_guard_platform_admin_column();

create or replace function public.grant_platform_admin_by_email(p_email text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_email text;
  target_id uuid;
begin
  select lower(trim(coalesce(u.email::text, ''))) into caller_email
  from auth.users u where u.id = auth.uid();
  if caller_email is distinct from 'premiereservicescontact@gmail.com' then
    raise exception 'Forbidden: only the supreme admin may assign platform admin roles';
  end if;
  select u.id into target_id
  from auth.users u
  where lower(trim(u.email::text)) = lower(trim(p_email))
  limit 1;
  if target_id is null then
    raise exception 'No account with that email';
  end if;
  update public.profiles
  set is_platform_admin = p_grant
  where user_id = target_id;
  if not found then
    raise exception 'That user has no profile row yet (they must sign in once).';
  end if;
end;
$$;

revoke all on function public.grant_platform_admin_by_email(text, boolean) from public;
grant execute on function public.grant_platform_admin_by_email(text, boolean) to authenticated;

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
  set is_verified = true, updated_at = now()
  where user_id = p_user_id;
end;
$$;

grant execute on function public.accept_pro_by_admin(uuid) to authenticated;

create or replace function public.remove_pro_by_admin(p_pro_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'Forbidden: admin only';
  end if;
  delete from public.pro_profiles where id = p_pro_profile_id;
end;
$$;

grant execute on function public.remove_pro_by_admin(uuid) to authenticated;

-- Policies: allow supreme or delegated moderators
drop policy if exists "Premiere admin can read payments" on public.payments;
create policy "Premiere admin can read payments"
  on public.payments for select to authenticated
  using (public.auth_is_platform_moderator());

drop policy if exists "Admin read all pro subscriptions by email" on public.pro_subscriptions;
create policy "Admin read all pro subscriptions by email"
  on public.pro_subscriptions for select to authenticated
  using (public.auth_is_platform_moderator());

drop policy if exists "Admin can read booking claim requests" on public.booking_claim_requests;
create policy "Admin can read booking claim requests"
  on public.booking_claim_requests for select to authenticated
  using (public.auth_is_platform_moderator());

drop policy if exists "Admin can update booking claim requests" on public.booking_claim_requests;
create policy "Admin can update booking claim requests"
  on public.booking_claim_requests for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

drop policy if exists "Premiere admin can update any pro profile" on public.pro_profiles;
drop policy if exists "Admin can update any pro profile" on public.pro_profiles;
create policy "Premiere platform moderators can update any pro profile"
  on public.pro_profiles for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

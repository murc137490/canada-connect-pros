-- Super admin: murc137490@gmail.com
-- Staff HR fields for platform admins + audit by member ID.

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

create table if not exists public.platform_admin_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  date_of_birth date,
  address text not null default '',
  phone text not null default '',
  phone_secondary text not null default '',
  email text not null default '',
  best_contact_method text not null default '',
  additional_info text not null default '',
  member_id text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admin_staff_member_id_format check (member_id ~ '^[0-9]{6}$')
);

create unique index if not exists platform_admin_staff_member_id_uidx
  on public.platform_admin_staff (member_id);

create unique index if not exists platform_admin_staff_email_uidx
  on public.platform_admin_staff (lower(trim(email)));

alter table public.platform_admin_staff enable row level security;

create or replace function public.auth_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select lower(trim(coalesce(u.email::text, ''))) = 'murc137490@gmail.com'
      from auth.users u
      where u.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.auth_is_super_admin() from public;
grant execute on function public.auth_is_super_admin() to authenticated;

create or replace function public.auth_is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    public.auth_is_super_admin()
    or coalesce(
      (
        select lower(trim(coalesce(u.email::text, ''))) in (
          'murc137490@gmail.com',
          'admin1@premiereservices.ca',
          'admin2@premiereservices.ca',
          'admin3@premiereservices.ca',
          'admin4@premiereservices.ca',
          'admin5@premiereservices.ca'
        )
        from auth.users u
        where u.id = auth.uid()
      ),
      false
    )
    or coalesce(
      (select p.is_platform_admin from public.profiles p where p.user_id = auth.uid()),
      false
    );
$$;

revoke all on function public.auth_is_platform_moderator() from public;
grant execute on function public.auth_is_platform_moderator() to authenticated;

drop policy if exists "Super admin manage platform_admin_staff" on public.platform_admin_staff;
create policy "Super admin manage platform_admin_staff"
  on public.platform_admin_staff
  for all
  to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

drop policy if exists "Admins read own staff row" on public.platform_admin_staff;
create policy "Admins read own staff row"
  on public.platform_admin_staff
  for select
  to authenticated
  using (user_id = auth.uid() or public.auth_is_platform_moderator());

create or replace function public.profiles_guard_platform_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if coalesce(new.is_platform_admin, false) = coalesce(old.is_platform_admin, false) then
    return new;
  end if;
  if public.auth_is_super_admin() then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  raise exception 'Platform admin role can only be changed by the super admin.';
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
  target_id uuid;
begin
  if not public.auth_is_super_admin() then
    raise exception 'Forbidden: only the super admin may assign platform admin roles';
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

-- Promote super admin profile; force Member ID 900366 onto murc137490@gmail.com.
do $$
declare
  uid uuid;
  conflict_uid uuid;
  free_id text;
begin
  select id into uid from auth.users where lower(trim(email)) = 'murc137490@gmail.com' limit 1;
  if uid is not null then
    select user_id into conflict_uid
    from public.profiles
    where public_user_number = '900366'
      and user_id <> uid
    limit 1;

    if conflict_uid is not null then
      if not exists (select 1 from public.profiles where public_user_number = '889840' and user_id <> conflict_uid) then
        update public.profiles set public_user_number = '889840' where user_id = conflict_uid;
      else
        loop
          free_id := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
          exit when not exists (select 1 from public.profiles where public_user_number = free_id);
        end loop;
        update public.profiles set public_user_number = free_id where user_id = conflict_uid;
      end if;
    end if;

    update public.profiles
    set is_platform_admin = true,
        public_user_number = '900366'
    where user_id = uid;

    insert into public.platform_admin_staff (user_id, email, member_id, full_name, created_by, updated_at)
    values (
      uid,
      'murc137490@gmail.com',
      '900366',
      coalesce((select full_name from public.profiles where user_id = uid), 'Super admin'),
      uid,
      now()
    )
    on conflict (user_id) do update
    set email = excluded.email,
        member_id = excluded.member_id,
        updated_at = now();
  end if;
end $$;

create table if not exists public.platform_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_member_id text,
  action text not null,
  target_user_id uuid,
  target_member_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_events_created_idx
  on public.platform_admin_audit_events (created_at desc);

alter table public.platform_admin_audit_events enable row level security;

drop policy if exists "Super admin read audit" on public.platform_admin_audit_events;
create policy "Super admin read audit"
  on public.platform_admin_audit_events
  for select
  to authenticated
  using (public.auth_is_super_admin());

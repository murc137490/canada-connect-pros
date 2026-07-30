-- Sync platform admin config to the five monitor accounts; strict auth_is_platform_moderator.

insert into public.platform_admin_config (key, value, updated_at)
values (
  'admin_emails',
  'admin1@premiereservices.ca,admin2@premiereservices.ca,admin3@premiereservices.ca,admin4@premiereservices.ca,admin5@premiereservices.ca',
  now()
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = excluded.updated_at;

create or replace function public.auth_is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(trim(coalesce(
    (select u.email::text from auth.users u where u.id = auth.uid()),
    coalesce(auth.jwt() ->> 'email', '')
  ))) = any (array[
    'admin1@premiereservices.ca',
    'admin2@premiereservices.ca',
    'admin3@premiereservices.ca',
    'admin4@premiereservices.ca',
    'admin5@premiereservices.ca'
  ]::text[])
$$;

-- Revoke stale is_platform_admin flags (SQL editor is not service_role; guard trigger blocks raw UPDATE).
alter table public.profiles disable trigger trg_profiles_guard_platform_admin;

do $$
declare
  r record;
  allow text[] := array[
    'admin1@premiereservices.ca',
    'admin2@premiereservices.ca',
    'admin3@premiereservices.ca',
    'admin4@premiereservices.ca',
    'admin5@premiereservices.ca'
  ];
begin
  for r in
    select p.user_id, lower(trim(u.email::text)) as em
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where coalesce(p.is_platform_admin, false) = true
  loop
    if not (r.em = any(allow)) then
      update public.profiles set is_platform_admin = false where user_id = r.user_id;
    end if;
  end loop;
end $$;

alter table public.profiles enable trigger trg_profiles_guard_platform_admin;

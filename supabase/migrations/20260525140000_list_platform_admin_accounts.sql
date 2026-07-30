-- Supreme admin only: list accounts with delegated platform admin (and supreme account).

create or replace function public.list_platform_admin_accounts()
returns table (
  user_id uuid,
  email text,
  full_name text,
  is_platform_admin boolean,
  is_supreme boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_email text;
begin
  select lower(trim(coalesce(u.email::text, ''))) into caller_email
  from auth.users u
  where u.id = auth.uid();

  if caller_email is distinct from 'premiereservicescontact@gmail.com' then
    raise exception 'Forbidden: supreme admin only';
  end if;

  return query
  select
    p.user_id,
    lower(trim(coalesce(u.email::text, '')))::text as email,
    coalesce(nullif(trim(p.full_name), ''), '')::text as full_name,
    coalesce(p.is_platform_admin, false) as is_platform_admin,
    (lower(trim(coalesce(u.email::text, ''))) = 'premiereservicescontact@gmail.com') as is_supreme
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where coalesce(p.is_platform_admin, false) = true
     or lower(trim(coalesce(u.email::text, ''))) = 'premiereservicescontact@gmail.com'
  order by is_supreme desc, u.email asc;
end;
$$;

revoke all on function public.list_platform_admin_accounts() from public;
grant execute on function public.list_platform_admin_accounts() to authenticated;

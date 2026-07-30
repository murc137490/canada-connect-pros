-- Platform moderators: read client account fields + auth email for issue reports.

create or replace function public.admin_client_account_summaries(p_user_ids uuid[])
returns table (
  user_id uuid,
  full_name text,
  phone text,
  postal_code text,
  address text,
  email_language text,
  birthday date,
  public_user_number text,
  email text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;
  return query
  select
    p.user_id,
    p.full_name,
    p.phone,
    p.postal_code,
    p.address,
    p.email_language,
    p.birthday,
    p.public_user_number::text,
    u.email::text
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.user_id = any (p_user_ids);
end;
$$;

revoke all on function public.admin_client_account_summaries(uuid[]) from public;
grant execute on function public.admin_client_account_summaries(uuid[]) to authenticated;

-- The held-name check runs inside a non-definer trigger, where RLS on username_history hides
-- other users' rows. Move the lookup into a SECURITY DEFINER helper.
create or replace function public.username_is_held_for_other(p_username text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.username_history h
    where lower(h.old_username) = lower(trim(coalesce(p_username, '')))
      and h.user_id is distinct from p_user_id
      and h.changed_at > now() - interval '90 days'
  );
$$;
revoke all on function public.username_is_held_for_other(text, uuid) from public, anon;
grant execute on function public.username_is_held_for_other(text, uuid) to authenticated, service_role;

create or replace function public.profiles_normalize_username()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  privileged boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (auth.uid() is null and current_user in ('postgres', 'supabase_admin'));
begin
  if new.username is null then
    return new;
  end if;
  new.username := nullif(lower(trim(new.username)), '');
  if new.username is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.username = lower(coalesce(old.username, '')) then
    return new;
  end if;
  if public.username_is_reserved(new.username) and not privileged then
    raise exception 'username_reserved' using errcode = '22023';
  end if;
  -- An old name stays with its previous owner for 90 days (their old links keep redirecting).
  if not privileged and public.username_is_held_for_other(new.username, new.user_id) then
    raise exception 'username_held' using errcode = '22023';
  end if;
  return new;
end;
$$;

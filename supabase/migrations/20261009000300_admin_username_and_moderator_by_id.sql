-- Moderator rights are tied to the user id (profiles.is_platform_admin) plus the super admin, never to an email list.
-- The staff account (user e99f0aaf-…) keeps its password, email and is_platform_admin and gets the login username "admin".

-- 1) Reserved usernames stay blocked for everyone, except when set by a privileged caller (service role / SQL editor)
--    or when an UPDATE carries the row's existing username unchanged (so the holder can still save their profile).
create or replace function public.profiles_normalize_username()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.username is null then
    return new;
  end if;
  new.username := nullif(lower(trim(new.username)), '');
  if new.username is not null
     and public.username_is_reserved(new.username)
     and not (tg_op = 'UPDATE' and new.username = lower(coalesce(old.username, '')))
     and not (
       coalesce(auth.jwt() ->> 'role', '') = 'service_role'
       or (auth.uid() is null and current_user in ('postgres', 'supabase_admin'))
     ) then
    raise exception 'username_reserved' using errcode = '22023';
  end if;
  return new;
end;
$function$;

-- 2) Give the staff account the "admin" login username (only if it has none yet).
update public.profiles
   set username = 'admin'
 where user_id = 'e99f0aaf-316e-491c-8235-7152b2b38ea0'
   and username is null;

-- 3) Moderator = super admin or profiles.is_platform_admin. No hard-coded staff emails.
create or replace function public.auth_is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select
    public.auth_is_super_admin()
    or coalesce(
      (select p.is_platform_admin from public.profiles p where p.user_id = auth.uid()),
      false
    );
$function$;

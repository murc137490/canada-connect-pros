-- Voice PIN for Front Desk caller-ID confirmation (My Account)
-- pgcrypto lives in schema "extensions" on Supabase

alter table public.profiles
  add column if not exists voice_pin_hash text;

comment on column public.profiles.voice_pin_hash is
  'bcrypt hash of 4–6 digit voice PIN used after caller-ID match on phone Front Desk';

create or replace function public.set_my_voice_pin(new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  cleaned text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  cleaned := regexp_replace(coalesce(new_pin, ''), '\D', '', 'g');
  if cleaned !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_pin', 'message', 'PIN must be 4–6 digits');
  end if;
  update public.profiles
  set voice_pin_hash = extensions.crypt(cleaned, extensions.gen_salt('bf')),
      updated_at = now()
  where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;
  return jsonb_build_object('ok', true, 'has_pin', true);
end;
$$;

create or replace function public.clear_my_voice_pin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.profiles
  set voice_pin_hash = null, updated_at = now()
  where user_id = uid;
  return jsonb_build_object('ok', true, 'has_pin', false);
end;
$$;

create or replace function public.my_voice_pin_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  h text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select voice_pin_hash into h from public.profiles where user_id = uid;
  return jsonb_build_object('ok', true, 'has_pin', (h is not null and length(h) > 0));
end;
$$;

create or replace function public.verify_voice_pin_hash(p_hash text, p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select coalesce(p_hash, '') <> ''
    and p_hash = extensions.crypt(regexp_replace(coalesce(p_pin, ''), '\D', '', 'g'), p_hash);
$$;

revoke all on function public.verify_voice_pin_hash(text, text) from public;
grant execute on function public.verify_voice_pin_hash(text, text) to service_role;

revoke all on function public.set_my_voice_pin(text) from public;
revoke all on function public.clear_my_voice_pin() from public;
revoke all on function public.my_voice_pin_status() from public;
grant execute on function public.set_my_voice_pin(text) to authenticated;
grant execute on function public.clear_my_voice_pin() to authenticated;
grant execute on function public.my_voice_pin_status() to authenticated;

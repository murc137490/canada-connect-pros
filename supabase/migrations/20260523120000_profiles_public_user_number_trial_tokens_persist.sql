-- Short 6-digit member IDs for profiles (display / admin). Auth user UUID unchanged.
-- Trial tokens: stop deleting claimed rows so admin history persists; cleanup only abandoned rows.

alter table public.profiles
  add column if not exists public_user_number text;

create or replace function public.allocate_public_user_number()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  num text;
  attempts int := 0;
begin
  loop
    num := lpad((trunc(random() * 1000000))::text, 6, '0');
    exit when not exists (select 1 from public.profiles p where p.public_user_number = num);
    attempts := attempts + 1;
    if attempts > 120 then
      raise exception 'Could not allocate public_user_number';
    end if;
  end loop;
  return num;
end;
$$;

create or replace function public.profiles_assign_public_user_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_user_number is not null and length(trim(new.public_user_number)) > 0 then
    return new;
  end if;
  new.public_user_number := public.allocate_public_user_number();
  return new;
end;
$$;

drop trigger if exists trg_profiles_assign_public_user_number on public.profiles;
create trigger trg_profiles_assign_public_user_number
  before insert on public.profiles
  for each row
  execute function public.profiles_assign_public_user_number();

comment on column public.profiles.public_user_number is 'Stable 6-digit display ID for the account (not the auth UUID).';

-- Backfill existing profiles (one-time).
do $$
declare
  r record;
begin
  for r in select user_id from public.profiles where public_user_number is null or length(trim(public_user_number)) = 0 loop
    update public.profiles
    set public_user_number = public.allocate_public_user_number()
    where user_id = r.user_id;
  end loop;
end $$;

create unique index if not exists profiles_public_user_number_uidx
  on public.profiles (public_user_number);

alter table public.profiles
  alter column public_user_number set not null;

-- Only remove never-issued / broken rows (no plaintext token and never claimed).
create or replace function public.cleanup_trial_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.trial_tokens
  where token_value is null
    and used_at is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_trial_tokens() from public;
grant execute on function public.cleanup_trial_tokens() to service_role;

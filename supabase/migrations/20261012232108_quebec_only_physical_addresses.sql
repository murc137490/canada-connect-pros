-- Keep postal and billing street addresses within Québec at the database boundary.
create or replace function public.is_quebec_physical_address(p_address text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(coalesce(p_address, '')), '') is null
    or upper(btrim(p_address)) ~ '(^|[, ])(QC|QUEBEC|QUÉBEC)([, ]|$)'
    or upper(btrim(p_address)) ~ '[GHJ][0-9][A-Z][ -]?[0-9][A-Z][0-9]';
$$;

create or replace function public.validate_profile_quebec_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.address is distinct from (case when tg_op = 'UPDATE' then old.address else null end)
     and not public.is_quebec_physical_address(new.address) then
    raise exception 'Physical address must be in Québec.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_pro_business_quebec_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.business_address is distinct from (case when tg_op = 'UPDATE' then old.business_address else null end)
     and not public.is_quebec_physical_address(new.business_address) then
    raise exception 'Business address must be in Québec.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_quebec_address_guard on public.profiles;
create trigger profiles_quebec_address_guard
before insert or update of address on public.profiles
for each row execute function public.validate_profile_quebec_address();

drop trigger if exists pro_profiles_quebec_address_guard on public.pro_profiles;
create trigger pro_profiles_quebec_address_guard
before insert or update of business_address on public.pro_profiles
for each row execute function public.validate_pro_business_quebec_address();

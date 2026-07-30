-- Client postal for invoices / browse sync; short human-facing booking reference (5 chars).

alter table public.profiles add column if not exists postal_code text;

alter table public.bookings add column if not exists public_booking_code text;

create unique index if not exists bookings_public_booking_code_uidx
  on public.bookings (public_booking_code)
  where public_booking_code is not null;

-- Unambiguous uppercase alnum (no 0/O or 1/I confusion).
create or replace function public.generate_public_booking_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
begin
  for i in 1..5 loop
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return s;
end;
$$;

create or replace function public.bookings_assign_public_booking_code() returns trigger
language plpgsql as $$
declare
  code text;
  attempts int := 0;
begin
  if new.public_booking_code is not null and length(trim(new.public_booking_code)) > 0 then
    return new;
  end if;
  loop
    code := public.generate_public_booking_code();
    exit when not exists (select 1 from public.bookings b where b.public_booking_code = code);
    attempts := attempts + 1;
    if attempts > 40 then
      raise exception 'Could not allocate public_booking_code';
    end if;
  end loop;
  new.public_booking_code := code;
  return new;
end;
$$;

drop trigger if exists trg_bookings_assign_public_code on public.bookings;
create trigger trg_bookings_assign_public_code
  before insert on public.bookings
  for each row
  execute function public.bookings_assign_public_booking_code();

-- Backfill existing rows (nullable column first; then NOT NULL).
do $$
declare
  r record;
  code text;
  attempts int;
  ok boolean;
begin
  for r in select id from public.bookings where public_booking_code is null loop
    attempts := 0;
    ok := false;
    while not ok and attempts < 50 loop
      code := public.generate_public_booking_code();
      ok := not exists (select 1 from public.bookings b where b.public_booking_code = code);
      attempts := attempts + 1;
    end loop;
    if not ok then
      raise exception 'Backfill public_booking_code failed for booking %', r.id;
    end if;
    update public.bookings set public_booking_code = code where id = r.id;
  end loop;
end $$;

alter table public.bookings alter column public_booking_code set not null;

comment on column public.profiles.postal_code is 'Canadian postal code for browse radius sync and receipts (normalized in app).';
comment on column public.bookings.public_booking_code is '5-character public booking reference for invoices and UI (unique).';

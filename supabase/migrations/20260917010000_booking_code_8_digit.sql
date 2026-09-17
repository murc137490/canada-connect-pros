-- 8-digit public booking codes (replaces 5-char alphanumeric generator going forward).
create or replace function public.generate_public_booking_code() returns text
language plpgsql volatile as $$
declare
  s text := '';
  i int;
begin
  for i in 1..8 loop
    s := s || (floor(random() * 10)::int)::text;
  end loop;
  -- Avoid all-zero
  if s = '00000000' then
    s := '10000000';
  end if;
  return s;
end;
$$;

comment on column public.bookings.public_booking_code is '8-digit public booking ID for invoices and UI (unique).';

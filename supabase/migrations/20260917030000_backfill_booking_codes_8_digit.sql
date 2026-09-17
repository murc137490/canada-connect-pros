-- Backfill legacy / non-8-digit public booking codes to 8-digit numeric IDs.
do $$
declare
  r record;
  new_code text;
begin
  for r in
    select id from public.bookings
    where public_booking_code is null
       or public_booking_code !~ '^[0-9]{8}$'
  loop
    loop
      new_code := public.generate_public_booking_code();
      exit when not exists (
        select 1 from public.bookings where public_booking_code = new_code
      );
    end loop;
    update public.bookings
    set public_booking_code = new_code
    where id = r.id;
  end loop;
end $$;

comment on column public.bookings.public_booking_code is '8-digit public booking ID for invoices and UI (unique).';

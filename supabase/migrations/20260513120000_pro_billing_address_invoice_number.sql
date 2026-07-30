-- Pro billing / REQ-style invoice fields + sequential booking invoice numbers.

-- ----- pro_profiles: legal name, business address (invoicing), tax IDs (optional) -----
alter table public.pro_profiles add column if not exists legal_business_name text;
alter table public.pro_profiles add column if not exists business_address text;
alter table public.pro_profiles add column if not exists gst_registration_number text;
alter table public.pro_profiles add column if not exists qst_registration_number text;

comment on column public.pro_profiles.legal_business_name is
  'Legal or REQ-registered name for invoices; if null, business_name is used.';
comment on column public.pro_profiles.business_address is
  'Full supplier address for Quebec invoices (required for new pros in the app).';

-- Backfill address from existing location text where missing.
update public.pro_profiles
set business_address = coalesce(nullif(trim(business_address), ''), nullif(trim(location), ''))
where business_address is null or trim(business_address) = '';

-- ----- bookings: sequential public invoice number -----
create sequence if not exists public.booking_invoice_number_seq;

alter table public.bookings add column if not exists invoice_number bigint;

create unique index if not exists bookings_invoice_number_uidx on public.bookings (invoice_number)
  where invoice_number is not null;

create or replace function public.assign_booking_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null then
    new.invoice_number := nextval('public.booking_invoice_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_assign_invoice_number on public.bookings;
create trigger trg_bookings_assign_invoice_number
  before insert on public.bookings
  for each row
  execute function public.assign_booking_invoice_number();

-- ----- payments: optional card metadata (reconciliation) -----
alter table public.payments add column if not exists card_brand text;
alter table public.payments add column if not exists card_last_4 text;

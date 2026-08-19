-- Per-service cancellation fee (My Services) + booking snapshots for fixed fees.
alter table public.pro_services
  add column if not exists cancel_policy text not null default 'late_fee',
  add column if not exists cancel_fee_type text not null default 'percent',
  add column if not exists cancel_fee_percent integer not null default 50,
  add column if not exists cancel_fee_cents integer not null default 0;

alter table public.pro_services drop constraint if exists pro_services_cancel_policy_check;
alter table public.pro_services add constraint pro_services_cancel_policy_check
  check (cancel_policy in ('free', 'late_fee', 'no_cancel'));

alter table public.pro_services drop constraint if exists pro_services_cancel_fee_type_check;
alter table public.pro_services add constraint pro_services_cancel_fee_type_check
  check (cancel_fee_type in ('percent', 'fixed'));

alter table public.pro_services drop constraint if exists pro_services_cancel_fee_percent_check;
alter table public.pro_services add constraint pro_services_cancel_fee_percent_check
  check (cancel_fee_percent in (25, 50, 75));

alter table public.pro_services drop constraint if exists pro_services_cancel_fee_cents_check;
alter table public.pro_services add constraint pro_services_cancel_fee_cents_check
  check (cancel_fee_cents >= 0 and cancel_fee_cents <= 10000000);

alter table public.bookings
  add column if not exists cancel_fee_type_snapshot text,
  add column if not exists cancel_fee_cents_snapshot integer;

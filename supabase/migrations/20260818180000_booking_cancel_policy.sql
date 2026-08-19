-- Pro booking cancellation policy + snapshot on bookings
alter table public.pro_profiles
  add column if not exists booking_cancel_policy text not null default 'late_fee',
  add column if not exists booking_cancel_fee_percent integer not null default 50;

alter table public.pro_profiles
  drop constraint if exists pro_profiles_booking_cancel_policy_check;
alter table public.pro_profiles
  add constraint pro_profiles_booking_cancel_policy_check
  check (booking_cancel_policy in ('free', 'late_fee', 'no_cancel'));

alter table public.pro_profiles
  drop constraint if exists pro_profiles_booking_cancel_fee_percent_check;
alter table public.pro_profiles
  add constraint pro_profiles_booking_cancel_fee_percent_check
  check (booking_cancel_fee_percent in (25, 50, 75));

alter table public.bookings
  add column if not exists cancel_policy_snapshot text,
  add column if not exists cancel_fee_percent_snapshot integer,
  add column if not exists cancel_policy_acknowledged_at timestamptz;

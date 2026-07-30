-- Run in Supabase SQL Editor if checkout says a bookings schedule column
-- is missing from the schema cache.

alter table public.bookings
  add column if not exists preferred_date date;

comment on column public.bookings.preferred_date
  is 'Client-selected preferred appointment date (YYYY-MM-DD).';

alter table public.bookings
  add column if not exists preferred_time time;

comment on column public.bookings.preferred_time
  is 'Client-selected preferred appointment start time (HH:MM).';

alter table public.bookings
  add column if not exists service_duration_minutes int;

alter table public.bookings
  drop constraint if exists bookings_service_duration_minutes_check;

alter table public.bookings
  add constraint bookings_service_duration_minutes_check
  check (service_duration_minutes is null or (service_duration_minutes >= 1 and service_duration_minutes <= 480));

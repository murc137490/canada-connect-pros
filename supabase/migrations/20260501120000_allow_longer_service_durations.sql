-- Allow service durations up to 8 hours. The app rounds values above 120 to
-- the closest 15-minute step before saving.

update public.pro_services
set duration_minutes = 480
where duration_minutes > 480;

update public.bookings
set service_duration_minutes = 480
where service_duration_minutes > 480;

alter table public.pro_services
  drop constraint if exists pro_services_duration_minutes_check;

alter table public.pro_services
  add constraint pro_services_duration_minutes_check
  check (duration_minutes is null or (duration_minutes >= 1 and duration_minutes <= 480));

alter table public.bookings
  drop constraint if exists bookings_service_duration_minutes_check;

alter table public.bookings
  add constraint bookings_service_duration_minutes_check
  check (service_duration_minutes is null or (service_duration_minutes >= 1 and service_duration_minutes <= 480));

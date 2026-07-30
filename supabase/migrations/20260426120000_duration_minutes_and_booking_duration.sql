-- Service duration in minutes. Used to compute end time on the schedule.
alter table public.pro_services
  add column if not exists duration_minutes int
  check (duration_minutes is null or duration_minutes >= 1);

-- Copy at booking time from the pro’s service; used for start/end on calendar.
alter table public.bookings
  add column if not exists service_duration_minutes int
  check (service_duration_minutes is null or service_duration_minutes >= 1);

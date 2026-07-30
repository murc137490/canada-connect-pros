-- Service location: workspace (client comes to pro), travel (pro goes to client), or both.
alter table public.pro_profiles
  add column if not exists offers_workspace boolean,
  add column if not exists offers_travel boolean;

update public.pro_profiles
set
  offers_workspace = coalesce(offers_workspace, case when service_at_workspace_only = true then true else true end),
  offers_travel = coalesce(offers_travel, case when service_at_workspace_only = true then false else true end)
where offers_workspace is null or offers_travel is null;

alter table public.pro_services
  add column if not exists location_mode text;

alter table public.pro_services
  drop constraint if exists pro_services_location_mode_check;

alter table public.pro_services
  add constraint pro_services_location_mode_check
  check (location_mode is null or location_mode in ('workspace', 'travel', 'both'));

comment on column public.pro_services.location_mode is
  'Where this service is delivered: workspace, travel, or both. Null = inherit from pro profile.';

alter table public.bookings
  add column if not exists service_location_choice text,
  add column if not exists distance_km_snapshot numeric(8, 2),
  add column if not exists drive_minutes_snapshot int;

alter table public.bookings
  drop constraint if exists bookings_service_location_choice_check;

alter table public.bookings
  add constraint bookings_service_location_choice_check
  check (service_location_choice is null or service_location_choice in ('workspace', 'travel'));

comment on column public.bookings.distance_km_snapshot is
  'Approximate driving distance (km) for travel bookings; no client address exposed to pros before accept.';

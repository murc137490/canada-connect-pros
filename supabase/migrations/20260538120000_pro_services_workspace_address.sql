-- Per-service workspace address (Google Places) for distance estimates from client browse postal.

alter table public.pro_services
  add column if not exists workspace_address text,
  add column if not exists workspace_latitude double precision,
  add column if not exists workspace_longitude double precision;

comment on column public.pro_services.workspace_address is
  'Street address when location_mode is workspace or both (client visits this location).';
comment on column public.pro_services.workspace_latitude is 'Geocoded latitude for workspace_address.';
comment on column public.pro_services.workspace_longitude is 'Geocoded longitude for workspace_address.';

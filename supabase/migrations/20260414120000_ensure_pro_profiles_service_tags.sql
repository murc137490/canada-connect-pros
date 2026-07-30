-- Idempotent: remote projects that never ran 20260302120000_pro_accent_banner_service_tags.sql
-- PostgREST error: "could not find the 'service_tags' column of 'pro_profiles' in the schema cache"

alter table public.pro_profiles
  add column if not exists pro_accent_color text,
  add column if not exists banner_image_url text,
  add column if not exists service_tags text[] default '{}'::text[];

comment on column public.pro_profiles.pro_accent_color is 'Accent color hex (e.g. #2563EB) for booking button, badges, borders, icons.';
comment on column public.pro_profiles.banner_image_url is 'Optional banner image URL (e.g. from Supabase Storage).';
comment on column public.pro_profiles.service_tags is 'Optional service tags (e.g. Emergency Repair, Commercial Work).';

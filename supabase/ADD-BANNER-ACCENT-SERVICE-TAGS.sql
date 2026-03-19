-- Add banner_image_url, pro_accent_color, and service_tags to pro_profiles if missing.
-- Run this in Supabase Dashboard → SQL Editor to fix "banner_image_url not in schema cache".

ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS pro_accent_color text,
  ADD COLUMN IF NOT EXISTS banner_image_url text,
  ADD COLUMN IF NOT EXISTS service_tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.pro_profiles.pro_accent_color IS 'Accent color hex for booking button, badges, borders, icons.';
COMMENT ON COLUMN public.pro_profiles.banner_image_url IS 'Optional banner image URL (e.g. from Supabase Storage).';
COMMENT ON COLUMN public.pro_profiles.service_tags IS 'Optional service tags (e.g. Emergency Repair, Commercial Work).';

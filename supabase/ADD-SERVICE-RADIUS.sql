-- Pro service area: radius in km from pro's location. Run once in Supabase SQL Editor.
-- Enables "serves your area" checks and pro service-area map (center + radius).

ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,2);

COMMENT ON COLUMN public.pro_profiles.service_radius_km IS 'Service area radius in km from latitude/longitude. Used to show clients if pro serves their area.';

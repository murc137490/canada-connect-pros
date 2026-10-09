-- Run once in Supabase SQL Editor. Pros can offer service at workspace only (no radius) or travel to clients (with radius).
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS service_at_workspace_only boolean DEFAULT false;

COMMENT ON COLUMN public.pro_profiles.service_at_workspace_only IS 'When true, client comes to pro; service_radius_km is ignored. When false, pro travels and service_radius_km applies.';

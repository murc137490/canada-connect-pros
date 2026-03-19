-- Optional: extra background color for the entire pro public page.
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- This complements ADD-PAGE-AESTHETIC.sql (template + primary/secondary/accent).

ALTER TABLE public.pro_profiles
ADD COLUMN IF NOT EXISTS page_background_color text;

COMMENT ON COLUMN public.pro_profiles.page_background_color IS 'Background color (hex) for the whole public profile page.';


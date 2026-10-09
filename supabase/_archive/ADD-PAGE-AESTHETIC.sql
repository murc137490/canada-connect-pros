-- Page aesthetic: template + colorways for pro public profile.
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- Template: 'classic' | 'minimal' | 'bold' | 'warm'
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS page_template text DEFAULT 'classic';

-- Hex colors for hero/headers, accents, highlights (e.g. #1e3a5f, #c2410c, #0d9488)
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS page_primary_color text;
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS page_secondary_color text;
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS page_accent_color text;

COMMENT ON COLUMN public.pro_profiles.page_template IS 'Profile page template: classic, minimal, bold, warm';
COMMENT ON COLUMN public.pro_profiles.page_primary_color IS 'Primary color (hex) for hero/headers';
COMMENT ON COLUMN public.pro_profiles.page_secondary_color IS 'Secondary color (hex) for accents';
COMMENT ON COLUMN public.pro_profiles.page_accent_color IS 'Accent color (hex) for highlights';

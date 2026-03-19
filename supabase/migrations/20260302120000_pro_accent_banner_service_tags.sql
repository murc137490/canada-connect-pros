-- Pro accent color (hex), banner image URL, and service tags for pro_profiles
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS pro_accent_color text,
  ADD COLUMN IF NOT EXISTS banner_image_url text,
  ADD COLUMN IF NOT EXISTS service_tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.pro_profiles.pro_accent_color IS 'Accent color hex (e.g. #2563EB) for booking button, badges, borders, icons.';
COMMENT ON COLUMN public.pro_profiles.banner_image_url IS 'Optional banner image URL (e.g. from Supabase Storage).';
COMMENT ON COLUMN public.pro_profiles.service_tags IS 'Optional service tags (e.g. Emergency Repair, Commercial Work).';

-- Create storage bucket for pro banner images (run in Dashboard > Storage if not using CLI).
-- Bucket name: pro-public. Public: true. File size limit and allowed MIME types as needed.

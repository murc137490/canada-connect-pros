-- Run once in Supabase SQL Editor: add customizable header text for pro public pages.
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS page_header_text text;
COMMENT ON COLUMN public.pro_profiles.page_header_text IS 'Optional HTML/text shown at top of public page, above About/Services/Credentials. Editable in dashboard.';

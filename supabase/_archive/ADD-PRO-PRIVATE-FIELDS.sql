-- Personal photo and ID document (private, for verification only). Run in Supabase SQL Editor.
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS personal_photo_url text,
  ADD COLUMN IF NOT EXISTS id_document_url text;

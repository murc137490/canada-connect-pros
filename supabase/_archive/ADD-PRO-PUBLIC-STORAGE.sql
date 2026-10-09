-- Pro banner images: create bucket and RLS so pros can upload to pro-public.
-- Run in Supabase SQL Editor to fix "new row violates row-level security policy" on banner upload.

-- 1. Create bucket (public so banner URLs work without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pro-public', 'pro-public', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow anyone to read (public bucket)
DROP POLICY IF EXISTS "Anyone can read pro-public" ON storage.objects;
CREATE POLICY "Anyone can read pro-public" ON storage.objects
  FOR SELECT USING (bucket_id = 'pro-public');

-- 3. Allow authenticated users to upload only to their own pro profile folder (banners/<pro_profile_id>/...)
DROP POLICY IF EXISTS "Pros can upload own banner" ON storage.objects;
CREATE POLICY "Pros can upload own banner" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pro-public'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[2]
    )
  );

-- 4. Allow pros to update/delete their own banner files
DROP POLICY IF EXISTS "Pros can update own banner" ON storage.objects;
CREATE POLICY "Pros can update own banner" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pro-public'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "Pros can delete own banner" ON storage.objects;
CREATE POLICY "Pros can delete own banner" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pro-public'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[2]
    )
  );

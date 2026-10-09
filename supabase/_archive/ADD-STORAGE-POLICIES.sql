-- Run once in Supabase SQL Editor. Fixes "new row violates row-level security policy" when creating a pro account (photo uploads).
-- Storage RLS: allow authenticated users to upload to pro-photos.

DROP POLICY IF EXISTS "Authenticated can upload pro-photos" ON storage.objects;
CREATE POLICY "Authenticated can upload pro-photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pro-photos' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Anyone can read pro-photos" ON storage.objects;
CREATE POLICY "Anyone can read pro-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'pro-photos');

DROP POLICY IF EXISTS "Users can update own pro-photos" ON storage.objects;
CREATE POLICY "Users can update own pro-photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own pro-photos" ON storage.objects;
CREATE POLICY "Users can delete own pro-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

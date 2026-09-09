-- Migration: Secure pro verification documents (selfie & government ID)
-- Move private verification files from public bucket 'pro-photos' to private bucket 'pro-verification'

-- 1. Create pro-verification private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pro-verification', 
  'pro-verification', 
  false, 
  10485760, 
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Move existing private selfie/ID files in storage.objects from pro-photos to pro-verification
UPDATE storage.objects
SET bucket_id = 'pro-verification'
WHERE bucket_id = 'pro-photos' AND name LIKE '%/private/%';

-- 3. RLS policies on storage.objects for pro-verification
DROP POLICY IF EXISTS "Pros upload own pro-verification" ON storage.objects;
CREATE POLICY "Pros upload own pro-verification"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pro-verification' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Pros read own pro-verification" ON storage.objects;
CREATE POLICY "Pros read own pro-verification"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-verification' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Pros update own pro-verification" ON storage.objects;
CREATE POLICY "Pros update own pro-verification"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pro-verification' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Pros delete own pro-verification" ON storage.objects;
CREATE POLICY "Pros delete own pro-verification"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pro-verification' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Platform moderators read all pro-verification" ON storage.objects;
CREATE POLICY "Platform moderators read all pro-verification"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-verification' AND 
  auth_is_platform_moderator()
);

DROP POLICY IF EXISTS "Platform moderators delete pro-verification" ON storage.objects;
CREATE POLICY "Platform moderators delete pro-verification"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pro-verification' AND 
  auth_is_platform_moderator()
);

-- 4. Secure pro-photos so that even if a private file is mistakenly uploaded there, public cannot read /private/
DROP POLICY IF EXISTS "Anyone can read pro-photos" ON storage.objects;
CREATE POLICY "Anyone can read pro-photos"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'pro-photos' AND 
  NOT (name LIKE '%/private/%')
);

-- 5. Update existing URLs in pro_profiles to point to pro-verification
UPDATE public.pro_profiles
SET personal_photo_url = REPLACE(personal_photo_url, '/storage/v1/object/public/pro-photos/', '/storage/v1/object/authenticated/pro-verification/')
WHERE personal_photo_url LIKE '%/pro-photos/%/private/%';

UPDATE public.pro_profiles
SET id_document_url = REPLACE(id_document_url, '/storage/v1/object/public/pro-photos/', '/storage/v1/object/authenticated/pro-verification/')
WHERE id_document_url LIKE '%/pro-photos/%/private/%';

# Fix: "Google Maps didn't load" + "new row violates row-level security policy"

## 1. RLS error (Create Pro Account submit)

The error usually comes from **Supabase Storage**: the `pro-photos` bucket has no INSERT policy, so uploads (profile photo, personal photo, ID, gallery) are blocked.

**Fix: run this SQL once** in Supabase Dashboard → SQL Editor:

```sql
-- Storage RLS: allow authenticated users to upload to pro-photos (path: user_id/...)
DROP POLICY IF EXISTS "Authenticated can upload pro-photos" ON storage.objects;
CREATE POLICY "Authenticated can upload pro-photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pro-photos' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Anyone can read pro-photos" ON storage.objects;
CREATE POLICY "Anyone can read pro-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'pro-photos');

-- Allow users to update/delete their own files (path starts with their user_id)
DROP POLICY IF EXISTS "Users can update own pro-photos" ON storage.objects;
CREATE POLICY "Users can update own pro-photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own pro-photos" ON storage.objects;
CREATE POLICY "Users can delete own pro-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

After this, creating a pro account (with photo uploads) should no longer hit RLS on storage.

---

## 2. Google Maps error on Create Pro Account

"If the page didn't load Google Maps correctly" then either:

- **Maps JavaScript API** is not enabled in Google Cloud (enable it next to Places API and Geocoding).
- **API key** is restricted and the current site (e.g. `localhost`) is not in the HTTP referrer list.
- **Billing** is not enabled on the Google project (Maps often requires it).

**App-side fix:** The form no longer depends on the map. If the map fails to load, you still get the **radius buttons** and the **location text field**, so you can submit without the map. If you see the error, you can ignore the map and fill "Service areas / location" and use the radius buttons; submission will work.

If you want to use the map: enable **Maps JavaScript API** in Google Cloud Console, add your key’s HTTP referrers (e.g. `http://localhost:*` and `https://www.premiereservices.ca/*`), and ensure billing is enabled.

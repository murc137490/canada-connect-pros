-- Run in Supabase SQL Editor if you see:
-- "Could not find the 'primary_category_slug' column of 'pro_profiles' in the schema cache"
-- (Also applied by: supabase/migrations/20260425120000_primary_category_and_saved_pros.sql)

alter table public.pro_profiles
  add column if not exists primary_category_slug text;

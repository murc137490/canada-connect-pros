-- Run once in Supabase SQL Editor. Allows admin to decline pro applications (they disappear from the list and can be emailed).
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS application_declined_at timestamptz;

-- Run in Supabase SQL Editor to remove a pro (and all related data) by business name.
-- Replace 'John Porks Toilet' with the exact business_name you want to remove.
-- This deletes the pro_profile and cascades to pro_services, pro_photos, pro_licenses, bookings, reviews, etc.

DELETE FROM public.pro_profiles
WHERE business_name = 'John Porks Toilet';

-- To remove by partial name (e.g. any business containing "john pork"):
-- DELETE FROM public.pro_profiles WHERE business_name ILIKE '%john pork%';

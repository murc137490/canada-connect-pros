-- Run in Supabase SQL Editor to convert johnpork23238@gmail.com from a pro to a normal account.
-- This deletes their pro profile (and cascades to pro_services, bookings, reviews, etc. for that pro).
-- The user keeps their auth account and can use the site as a normal client.

DELETE FROM public.pro_profiles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'johnpork23238@gmail.com');

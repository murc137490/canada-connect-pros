-- ============================================================
-- EASIEST WAY: Accept a user as a Pro (one copy-paste in SQL Editor)
-- ============================================================
-- In this app, "pro" = has a row in pro_profiles. No role column needed.
--
-- WHERE TO GO:
--   Supabase Dashboard → SQL Editor → New query → paste ONE of the blocks below → Run
--
-- WHAT TO CHANGE:
--   Replace the user UID (and optionally the business name) with the real values.
--   Example: John Pork with UID 8114041d-99d7-4ac1-b901-af0649f20bc7
-- ============================================================

-- ONE SCRIPT: Accept (and verify) a user as Pro.
-- - If they have NO pro profile: creates one (they can complete it after login).
-- - If they already have one: just sets is_verified = true.
INSERT INTO public.pro_profiles (user_id, business_name, is_verified)
VALUES (
  '8114041d-99d7-4ac1-b901-af0649f20bc7',   -- ← CHANGE: paste the user's UID from Auth → Users
  'John Pork',                                -- ← CHANGE: display/business name
  true
)
ON CONFLICT (user_id) DO UPDATE SET is_verified = true, updated_at = now();

-- To confirm: Dashboard → Table Editor → pro_profiles → filter by user_id = that UID.

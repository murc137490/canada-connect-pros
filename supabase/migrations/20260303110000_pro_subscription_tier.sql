-- Subscription tier for pro_profiles (starter, growth, pro). Admins can set via dashboard.
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'starter';

COMMENT ON COLUMN public.pro_profiles.subscription_tier IS 'Plan tier: starter, growth, or pro. Used for feature gating (e.g. calendar month access).';

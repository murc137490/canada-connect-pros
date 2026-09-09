-- Migration: Lock down public.profiles table personal information & create safe public_profiles view
-- Prevents unauthenticated strangers and unauthorized users from querying phone, birthday, address, postal_code, ID photo paths

-- 1. Create safe public_profiles view exposing only public display fields
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = false) AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  public_user_number
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2. Create helper function for single profile lookup
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (user_id uuid, full_name text, avatar_url text, public_user_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, p.public_user_number
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- 3. Lock down public.profiles table
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Moderators read profiles for support" ON public.profiles;
DROP POLICY IF EXISTS "Moderators view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Booking counterparties view profile" ON public.profiles;

-- Owner can read their own full profile
CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Platform moderators / staff admins can read profiles for support & verification
CREATE POLICY "Moderators view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth_is_platform_moderator());

-- Booking & quote counterparties can read profile for active booking coordination
CREATE POLICY "Booking counterparties view profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.pro_profiles pp ON pp.id = b.pro_profile_id
    WHERE (b.client_id = profiles.user_id AND pp.user_id = auth.uid())
       OR (pp.user_id = profiles.user_id AND b.client_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.job_quotes jq
    JOIN public.job_requests jr ON jr.id = jq.job_request_id
    JOIN public.pro_profiles pp ON pp.id = jq.pro_profile_id
    WHERE (jr.client_id = profiles.user_id AND pp.user_id = auth.uid())
       OR (pp.user_id = profiles.user_id AND jr.client_id = auth.uid())
  )
);

-- 4. Enable RLS on public.services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
CREATE POLICY "Anyone can view services"
ON public.services
FOR SELECT
USING (true);

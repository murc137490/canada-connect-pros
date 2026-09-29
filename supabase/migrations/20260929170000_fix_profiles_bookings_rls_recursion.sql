-- Fix profiles ↔ bookings RLS infinite recursion.
-- bookings SELECT checked profiles.is_platform_admin under invoker RLS;
-- profiles counterparty policy SELECTed bookings → cycle.

CREATE OR REPLACE FUNCTION public.auth_uid_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT coalesce(
    (SELECT p.is_platform_admin FROM public.profiles p WHERE p.user_id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_uid_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_can_view_profile_as_counterparty(p_profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_profile_user_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.pro_profiles pp ON pp.id = b.pro_profile_id
        WHERE (b.client_id = p_profile_user_id AND pp.user_id = auth.uid())
           OR (pp.user_id = p_profile_user_id AND b.client_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.job_quotes jq
        JOIN public.job_requests jr ON jr.id = jq.job_request_id
        JOIN public.pro_profiles pp ON pp.id = jq.pro_profile_id
        WHERE (jr.client_id = p_profile_user_id AND pp.user_id = auth.uid())
           OR (pp.user_id = p_profile_user_id AND jr.client_id = auth.uid())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.auth_can_view_profile_as_counterparty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_view_profile_as_counterparty(uuid) TO authenticated;

DROP POLICY IF EXISTS "Clients and pros can view own bookings" ON public.bookings;
CREATE POLICY "Clients and pros can view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_id
  OR EXISTS (
    SELECT 1
    FROM public.pro_profiles p
    WHERE p.id = bookings.pro_profile_id
      AND p.user_id = auth.uid()
  )
  OR public.auth_uid_is_platform_admin()
);

DROP POLICY IF EXISTS "Booking counterparties view profile" ON public.profiles;
CREATE POLICY "Booking counterparties view profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.auth_can_view_profile_as_counterparty(profiles.user_id));

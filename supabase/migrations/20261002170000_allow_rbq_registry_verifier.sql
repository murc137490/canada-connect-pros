-- The authenticated verify-rbq-license Edge Function uses the service role only
-- after checking that the caller owns the professional profile. Permit that
-- trusted role to persist RBQ registry results; authenticated users remain blocked.
CREATE OR REPLACE FUNCTION public.prevent_pro_license_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
    AND NOT public.auth_is_platform_moderator()
    AND (
      NEW.is_verified IS DISTINCT FROM OLD.is_verified
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.verification_data IS DISTINCT FROM OLD.verification_data
    ) THEN
    RAISE EXCEPTION 'Only the RBQ registry verifier or platform moderators can change licence verification status';
  END IF;
  RETURN NEW;
END;
$$;

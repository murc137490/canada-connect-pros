-- Run in Supabase SQL Editor. Lets admin (premiereservicescontact@gmail.com) accept and remove pros via RPC (no Edge Functions needed).
-- Grant usage on auth to the function's search_path or use auth.users in the function.

CREATE OR REPLACE FUNCTION public.accept_pro_by_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(caller_email)) <> 'premiereservicescontact@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  UPDATE public.pro_profiles
  SET is_verified = true, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_pro_by_admin(p_pro_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(caller_email)) <> 'premiereservicescontact@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  DELETE FROM public.pro_profiles WHERE id = p_pro_profile_id;
END;
$$;

-- Allow authenticated users to call (RPC checks admin itself)
GRANT EXECUTE ON FUNCTION public.accept_pro_by_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pro_by_admin(uuid) TO authenticated;

-- Pre-launch security hardening (2026-10-08)
-- DO NOT apply from the app agent — owner applies via Supabase SQL editor / CLI.
-- Goals:
-- 1) public_profiles: security_invoker + revoke writes
-- 2) Revoke anon/PUBLIC execute on sensitive SECURITY DEFINER RPCs
-- 3) Fix mutable search_path on flagged functions
-- Keep EXECUTE for RPCs the SPA legitimately calls as anon/authenticated
-- (get_top_picks, get_pro_avg_rating, increment_service_browse_stats,
--  get_top_services_by_browse, get_public_profile, acknowledge_*, etc.).

-- ---------------------------------------------------------------------------
-- 1. public_profiles view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  user_id,
  full_name,
  avatar_url,
  public_user_number
FROM public.profiles;

REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.public_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

-- With security_invoker = on, callers need SELECT on the underlying columns.
-- Restrict anon to display columns only so private profile fields stay hidden
-- even if a future policy opens row access.
-- Anon-only row policy for the public_profiles view (security_invoker).
-- Column privileges below still block anon from reading phone/address/etc.
-- Do NOT grant USING (true) to authenticated — they already have own/moderator/
-- counterparty policies with full-column access.
DROP POLICY IF EXISTS "Public display fields readable" ON public.profiles;
CREATE POLICY "Anon can read display profile fields"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON TABLE public.profiles FROM anon;
GRANT SELECT (user_id, full_name, avatar_url, public_user_number) ON TABLE public.profiles TO anon;
-- authenticated keeps broader SELECT via existing table grants + RLS policies.

-- ---------------------------------------------------------------------------
-- 2. Revoke sensitive SECURITY DEFINER EXECUTE from anon / PUBLIC
-- ---------------------------------------------------------------------------

-- Email / PII leaks
REVOKE ALL ON FUNCTION public.get_email_for_name(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_email_for_name(text) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_pro_and_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pro_and_user(uuid) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.platform_admin_emails() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_admin_emails() FROM anon;
-- Keep authenticated for any admin UI that still reads it; prefer edge functions.

-- Destructive / cron-only
REVOKE ALL ON FUNCTION public.purge_job_requests_older_than_seven_days() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_job_requests_older_than_seven_days() FROM anon;
-- authenticated retained so signed-in dashboard can still trigger purge (cron also runs it).

REVOKE ALL ON FUNCTION public.cleanup_trial_tokens() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_trial_tokens() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_trial_tokens() TO service_role;

-- Admin-only RPCs: strip anon (body still checks role for authenticated callers)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'accept_pro_by_admin',
        'admin_set_pro_subscription_tier',
        'admin_client_account_summaries',
        'remove_pro_by_admin',
        'moderate_job_request_admin',
        'grant_platform_admin_by_email'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- Trigger / internal helpers should not be callable by anon
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'handle_new_user',
        'lock_client_review_pair_on_delete',
        'lock_review_pair_on_delete',
        'prevent_pro_license_self_verification',
        'prevent_pro_verification_self_review',
        'pro_profiles_assign_pro_member_id',
        'pro_profiles_enforce_subscription_tier_billing',
        'pro_profiles_ensure_hold_subscription',
        'pro_profiles_lock_phone',
        'profiles_assign_public_user_number',
        'profiles_guard_platform_admin_column',
        'profiles_lock_phone_and_pin',
        'sync_pro_member_id_from_profile',
        'allocate_public_user_number',
        'bookings_assign_public_booking_code',
        'auth_lock_email_change'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Mutable search_path fixes (advisor function_search_path_mutable)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'distance_km',
        'normalize_name',
        'get_pro_and_user',
        'bookings_assign_public_booking_code',
        'generate_public_booking_code',
        'match_services',
        'calculate_proration',
        'assign_booking_invoice_number',
        'allocate_pro_member_id'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

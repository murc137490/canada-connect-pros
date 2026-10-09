-- Security review 2026-10-08, MED 8: function EXECUTE grants + search_path.
-- Callers were checked in src/ and supabase/functions before each revoke:
--   set_my_voice_pin / clear_my_voice_pin / my_voice_pin_status / change_my_public_user_number
--     → MemberIdSettings.tsx (signed-in)            → revoke anon only
--   reconcile_my_referrals → Dashboard.tsx (signed-in) → revoke anon only
--   acknowledge_* → bookingNotifications.ts (signed-in) → revoke anon only
--   change_my_pro_member_id → no caller               → revoke anon only
--   *_enforce_client_request_limit, mark_referral_invite_completed → trigger functions
--     (EXECUTE is only checked at CREATE TRIGGER time)  → revoke public/anon/authenticated
--   auth_* helpers → used only inside RLS policies scoped TO authenticated → revoke anon
--   platform_admin_emails() → no app/edge caller, not referenced by policies/functions → revoke authenticated
-- NOT revoked: purge_job_requests_older_than_seven_days() stays executable by authenticated because
--   src/lib/purgeStaleJobRequests.ts (Dashboard) is the only thing enforcing the 7-day retention
--   (no cron job exists). Move it to pg_cron first, then revoke.
-- Role checks verified in: accept_pro_by_admin, remove_pro_by_admin, admin_set_pro_subscription_tier,
--   moderate_job_request_admin, admin_client_account_summaries (auth_is_platform_moderator()) and
--   grant_platform_admin_by_email (auth_is_super_admin()).

revoke execute on function public.set_my_voice_pin(text) from public, anon;
revoke execute on function public.clear_my_voice_pin() from public, anon;
revoke execute on function public.my_voice_pin_status() from public, anon;
revoke execute on function public.change_my_pro_member_id(text) from public, anon;
revoke execute on function public.change_my_public_user_number(text) from public, anon;
revoke execute on function public.reconcile_my_referrals() from public, anon;
revoke execute on function public.acknowledge_client_booking(uuid) from public, anon;
revoke execute on function public.acknowledge_client_booking_notifications() from public, anon;
revoke execute on function public.acknowledge_pro_booking_notifications() from public, anon;

revoke execute on function public.auth_can_view_profile_as_counterparty(uuid) from public, anon;
revoke execute on function public.auth_is_platform_moderator() from public, anon;
revoke execute on function public.auth_is_super_admin() from public, anon;
revoke execute on function public.auth_uid_is_platform_admin() from public, anon;

revoke execute on function public.bookings_enforce_client_request_limit() from public, anon, authenticated;
revoke execute on function public.job_quotes_enforce_client_request_limit() from public, anon, authenticated;
revoke execute on function public.mark_referral_invite_completed() from public, anon, authenticated;

revoke execute on function public.platform_admin_emails() from public, anon, authenticated;

-- Pure helpers: pin search_path (function_search_path_mutable).
alter function public.pro_client_request_limit(text) set search_path = '';
alter function public.booking_series_step(date, text) set search_path = '';

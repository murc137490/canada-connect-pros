-- Security follow-up 2026-10-09 (part 2 of 2): make the exact workspace address / coordinates
-- private. Apply only after the frontend that reads workspace_*_approx + get_pro_service_workspace()
-- is live (20261009100900).
-- Column-level SELECT: table-wide SELECT is revoked from anon/authenticated, then every column
-- except workspace_address / workspace_latitude / workspace_longitude is granted back.
-- INSERT/UPDATE/DELETE (owner-only via RLS) are unchanged; owners read their exact values through
-- get_pro_service_workspace(). Also drops the TRUNCATE/REFERENCES/TRIGGER grants nobody needs.

revoke select, truncate, references, trigger on public.pro_services from anon, authenticated;

grant select (
  id, pro_profile_id, service_slug, category_slug, custom_price_min, custom_price_max, description,
  created_at, display_name, duration_minutes, auto_reply_message, renewal_interval_months,
  location_mode, cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents,
  workspace_latitude_approx, workspace_longitude_approx
) on public.pro_services to anon, authenticated;

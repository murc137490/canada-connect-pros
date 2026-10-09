-- Security review 2026-10-08, HIGH 1 (part B) + LOW 12 keep-alive grant.
-- !!! Apply ONLY after the frontend from PR "security-review-fixes-2026-10-08" is merged AND
-- deployed (and the keep-alive workflow on main uses platform_keepalive_ping()). The live frontend
-- before that PR uses select('*') on pro_profiles and would break for every visitor.
--
-- anon/authenticated lose table-wide SELECT and get column SELECT on the public-safe set only.
-- Owners read their full row via get_my_pro_profile(); moderators via admin_get_pro_profiles();
-- signed-in clients get invoice supplier fields via get_pro_billing_details(); booking
-- availability is exposed only as OPEN windows via get_pro_open_slots().
-- UPDATE/INSERT/DELETE privileges are unchanged for authenticated (RLS still limits them to the
-- owner / moderators). Every browser .insert()/.update() on pro_profiles either returns nothing or
-- only `id` (granted), so RETURNING keeps working.

revoke select on public.pro_profiles from anon, authenticated;
grant select (
  id,
  user_id,
  business_name,
  bio,
  location_city,
  years_experience,
  price_min,
  price_max,
  availability,
  is_verified,
  primary_category_slug,
  service_tags,
  banner_image_url,
  pro_accent_color,
  page_template,
  page_header_text,
  page_primary_color,
  page_secondary_color,
  page_background_color,
  page_accent_color,
  service_at_workspace_only,
  service_radius_km,
  offers_travel,
  offers_workspace,
  subscription_tier,
  square_location_id,
  share_slug,
  pro_member_id,
  booking_cancel_policy,
  booking_cancel_fee_percent,
  created_at,
  latitude_approx,
  longitude_approx
) on public.pro_profiles to anon, authenticated;

-- anon never writes pro_profiles (all write policies need auth.uid()); drop the unused grants.
revoke insert, update, delete, truncate, references, trigger on public.pro_profiles from anon;
revoke truncate, references, trigger on public.pro_profiles from authenticated;

-- LOW 12: keep-alive now goes through platform_keepalive_ping(); no anon writes to the table.
drop policy if exists "Anon can update keepalive" on public.platform_keepalive;
revoke insert, update, delete, truncate, references, trigger on public.platform_keepalive from anon, authenticated;

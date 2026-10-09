-- ============================================================
-- SHOWCASE SEED — all plumbing examples + johnpork23238@gmail.com as Pro
-- Run in Supabase SQL Editor (safe to re-run; upserts showcase data).
-- ============================================================
-- Uses EXISTING auth users (no password creation):
--   johnpork23238@gmail.com          → full PRO showcase (plumbing suite)
--   premiereservicescontact@gmail.com → GROWTH showcase (drain cleaning)
--   bobjohnsongod@gmail.com          → STARTER showcase (plumbing)
--
-- After running:
--   CLIENT view: open site, postal H2Y 1C6 / H3Z 2K4, browse Services → see 3 pros
--   PRO view:    login johnpork23238@gmail.com → Dashboard Pro tab
-- ============================================================

DO $$
DECLARE
  v_john_uid uuid;
  v_growth_uid uuid;
  v_starter_uid uuid;
  v_john_pro uuid;
  v_growth_pro uuid;
  v_starter_pro uuid;
  v_client_uid uuid;
BEGIN
  SELECT id INTO v_john_uid FROM auth.users WHERE lower(email) = lower('johnpork23238@gmail.com') LIMIT 1;
  SELECT id INTO v_growth_uid FROM auth.users WHERE lower(email) = lower('premiereservicescontact@gmail.com') LIMIT 1;
  SELECT id INTO v_starter_uid FROM auth.users WHERE lower(email) = lower('bobjohnsongod@gmail.com') LIMIT 1;

  IF v_john_uid IS NULL THEN
    RAISE EXCEPTION 'Auth user johnpork23238@gmail.com not found';
  END IF;

  -- Pick any other user as mock client for sample bookings (optional)
  SELECT id INTO v_client_uid
  FROM auth.users
  WHERE id NOT IN (v_john_uid, coalesce(v_growth_uid, v_john_uid), coalesce(v_starter_uid, v_john_uid))
  LIMIT 1;
  IF v_client_uid IS NULL THEN
    v_client_uid := coalesce(v_growth_uid, v_starter_uid);
  END IF;

  -- ---------- PROFILES (client-facing contact) ----------
  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language)
  VALUES (v_john_uid, 'John Pork', '514-555-2300', 'H2Y 1C6', 'fr')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        postal_code = EXCLUDED.postal_code,
        email_language = EXCLUDED.email_language,
        updated_at = now();

  IF v_growth_uid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language)
    VALUES (v_growth_uid, 'Camille Growth', '514-555-2700', 'H3Z 2K4', 'fr')
    ON CONFLICT (user_id) DO UPDATE
      SET full_name = EXCLUDED.full_name, postal_code = EXCLUDED.postal_code, updated_at = now();
  END IF;

  IF v_starter_uid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language)
    VALUES (v_starter_uid, 'Alex Starter', '514-555-2000', 'H2X 1Y4', 'fr')
    ON CONFLICT (user_id) DO UPDATE
      SET full_name = EXCLUDED.full_name, postal_code = EXCLUDED.postal_code, updated_at = now();
  END IF;

  -- ---------- JOHN = full PRO showcase ----------
  INSERT INTO public.pro_profiles (
    user_id, business_name, legal_business_name, bio, location,
    latitude, longitude, service_radius_km, phone, website,
    years_experience, is_verified, subscription_tier,
    primary_category_slug, price_min, price_max,
    availability, offers_travel, offers_workspace, service_at_workspace_only,
    business_address, gst_registration_number, qst_registration_number,
    page_header_text, page_primary_color, page_secondary_color, page_accent_color,
    page_template, booking_cancel_policy, booking_cancel_fee_percent,
    referral_invite_panel_enabled
  ) VALUES (
    v_john_uid,
    'Pork Plomberie Pro (Showcase)',
    'Pork Plomberie Inc.',
    'Compte démo PRO — plomberie seulement : fuites, drains, chauffe-eau, dépannage. SMS, frais d’annulation, workspace + déplacement.',
    'Montréal, QC',
    45.5017, -73.5673, 30,
    '514-555-2300', 'https://www.premiereservices.ca',
    12, true, 'pro',
    'home-improvement', 75, 220,
    'Mon–Fri 9:00–17:00 · Sam 9:00–15:00',
    true, true, false,
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
    '123456789RT0001', '1234567890TQ0001',
    'Showcase Pro — plomberie',
    '#163a6b', '#0f2744', '#3b82f6',
    'classic', 'late_fee', 50,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    legal_business_name = EXCLUDED.legal_business_name,
    bio = EXCLUDED.bio,
    location = EXCLUDED.location,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    service_radius_km = EXCLUDED.service_radius_km,
    phone = EXCLUDED.phone,
    years_experience = EXCLUDED.years_experience,
    is_verified = true,
    subscription_tier = 'pro',
    primary_category_slug = EXCLUDED.primary_category_slug,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    availability = EXCLUDED.availability,
    offers_travel = true,
    offers_workspace = true,
    service_at_workspace_only = false,
    business_address = EXCLUDED.business_address,
    gst_registration_number = EXCLUDED.gst_registration_number,
    qst_registration_number = EXCLUDED.qst_registration_number,
    page_header_text = EXCLUDED.page_header_text,
    page_primary_color = EXCLUDED.page_primary_color,
    booking_cancel_policy = 'late_fee',
    booking_cancel_fee_percent = 50,
    referral_invite_panel_enabled = true,
    updated_at = now()
  RETURNING id INTO v_john_pro;

  IF v_john_pro IS NULL THEN
    SELECT id INTO v_john_pro FROM public.pro_profiles WHERE user_id = v_john_uid;
  END IF;

  DELETE FROM public.pro_subscriptions WHERE user_id = v_john_uid;
  INSERT INTO public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
  VALUES (v_john_uid, 'pro', now() - interval '10 days', 30, now());

  DELETE FROM public.pro_services WHERE pro_profile_id = v_john_pro;
  INSERT INTO public.pro_services (
    pro_profile_id, category_slug, service_slug, display_name,
    custom_price_min, custom_price_max, duration_minutes, description,
    auto_reply_message, renewal_interval_months, location_mode,
    workspace_address, workspace_latitude, workspace_longitude,
    cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents
  ) VALUES
  (
    v_john_pro, 'home-improvement', 'plumbing-services', 'Plomberie express',
    95, 95, 90, 'Fuites, robinets, toilettes — plomberie générale. Démo PRO.',
    'Merci pour votre demande — je confirme sous 2 h.', 12, 'both',
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6', 45.503, -73.558,
    'late_fee', 'fixed', 50, 2000
  ),
  (
    v_john_pro, 'home-improvement', 'drain-cleaning', 'Débouchage de drains',
    120, 120, 90, 'Drains cuisine/salle de bain, caméra optionnelle.',
    'Message auto — reçu. Je confirme le créneau sous peu.', NULL, 'travel',
    NULL, NULL, NULL,
    'late_fee', 'percent', 25, 0
  ),
  (
    v_john_pro, 'home-improvement', 'water-heater-services', 'Chauffe-eau',
    150, 150, 180, 'Installation, entretien et remplacement de chauffe-eau.',
    NULL, 6, 'workspace',
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6', 45.503, -73.558,
    'free', 'percent', 50, 0
  ),
  (
    v_john_pro, 'home-improvement', 'bathroom-remodel', 'Plomberie salle de bain',
    175, 175, 120, 'Robinets, toilette, douche — rénovation plomberie salle de bain.',
    NULL, NULL, 'travel',
    NULL, NULL, NULL,
    'no_cancel', 'percent', 50, 0
  );

  INSERT INTO public.pro_licenses (pro_profile_id, license_number, license_type, holder_name, is_verified)
  SELECT v_john_pro, 'RBQ-SHOW-001', 'RBQ', 'Pork Plomberie Inc.', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pro_licenses WHERE pro_profile_id = v_john_pro AND license_number = 'RBQ-SHOW-001'
  );

  -- ---------- GROWTH showcase (client browse) ----------
  IF v_growth_uid IS NOT NULL THEN
    INSERT INTO public.pro_profiles (
      user_id, business_name, bio, location, latitude, longitude, service_radius_km,
      phone, years_experience, is_verified, subscription_tier, primary_category_slug,
      price_min, price_max, offers_travel, offers_workspace,
      booking_cancel_policy, booking_cancel_fee_percent, page_header_text
    ) VALUES (
      v_growth_uid,
      'Camille Croissance Plomberie',
      'Compte démo GROWTH — plomberie : auto-reply, renouvellement, bundles possibles.',
      'Westmount, QC', 45.485, -73.597, 20,
      '514-555-2700', 6, true, 'growth', 'home-improvement',
      60, 140, true, false,
      'late_fee', 25, 'Growth showcase — plomberie'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      bio = EXCLUDED.bio,
      is_verified = true,
      subscription_tier = 'growth',
      primary_category_slug = 'home-improvement',
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      booking_cancel_policy = 'late_fee',
      booking_cancel_fee_percent = 25,
      updated_at = now()
    RETURNING id INTO v_growth_pro;

    IF v_growth_pro IS NULL THEN
      SELECT id INTO v_growth_pro FROM public.pro_profiles WHERE user_id = v_growth_uid;
    END IF;

    DELETE FROM public.pro_subscriptions WHERE user_id = v_growth_uid;
    INSERT INTO public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
    VALUES (v_growth_uid, 'growth', now() - interval '5 days', 30, now());

    DELETE FROM public.pro_services WHERE pro_profile_id = v_growth_pro;
    INSERT INTO public.pro_services (
      pro_profile_id, category_slug, service_slug, display_name,
      custom_price_min, custom_price_max, duration_minutes, description,
      auto_reply_message, renewal_interval_months, location_mode,
      cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents
    ) VALUES (
      v_growth_pro, 'home-improvement', 'drain-cleaning', 'Débouchage résidentiel',
      110, 110, 90, 'Débouchage drains — démo Growth.',
      'Merci! Je vous envoie un créneau sous peu.', 1, 'travel',
      'late_fee', 'percent', 50, 0
    );
  END IF;

  -- ---------- STARTER showcase (client browse) ----------
  IF v_starter_uid IS NOT NULL THEN
    INSERT INTO public.pro_profiles (
      user_id, business_name, bio, location, latitude, longitude, service_radius_km,
      phone, years_experience, is_verified, subscription_tier, primary_category_slug,
      price_min, price_max, offers_travel, offers_workspace,
      booking_cancel_policy, booking_cancel_fee_percent, page_header_text
    ) VALUES (
      v_starter_uid,
      'Alex Starter Plomberie',
      'Compte démo STARTER — plomberie simple, un service, annulation gratuite.',
      'Plateau, QC', 45.52, -73.58, 15,
      '514-555-2000', 3, true, 'starter', 'home-improvement',
      50, 90, true, false,
      'free', 50, 'Starter showcase — plomberie'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      bio = EXCLUDED.bio,
      is_verified = true,
      subscription_tier = 'starter',
      primary_category_slug = 'home-improvement',
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      booking_cancel_policy = 'free',
      updated_at = now()
    RETURNING id INTO v_starter_pro;

    IF v_starter_pro IS NULL THEN
      SELECT id INTO v_starter_pro FROM public.pro_profiles WHERE user_id = v_starter_uid;
    END IF;

    DELETE FROM public.pro_subscriptions WHERE user_id = v_starter_uid;
    INSERT INTO public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
    VALUES (v_starter_uid, 'starter', now() - interval '3 days', 30, now());

    DELETE FROM public.pro_services WHERE pro_profile_id = v_starter_pro;
    INSERT INTO public.pro_services (
      pro_profile_id, category_slug, service_slug, display_name,
      custom_price_min, custom_price_max, duration_minutes, description,
      location_mode, cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents
    ) VALUES (
      v_starter_pro, 'home-improvement', 'plumbing-services', 'Petites réparations plomberie',
      65, 65, 60, 'Robinets / joints — démo Starter.',
      'travel', 'free', 'percent', 50, 0
    );
  END IF;

  -- ---------- Sample bookings on John's pro (dashboard walkthrough) ----------
  IF v_client_uid IS NOT NULL AND v_client_uid <> v_john_uid THEN
    DELETE FROM public.bookings
    WHERE pro_profile_id = v_john_pro
      AND public_booking_code LIKE 'SHOW-%';

    INSERT INTO public.bookings (
      pro_profile_id, client_id, status, preferred_date, preferred_time,
      service_duration_minutes, service_category_slug, service_slug,
      public_booking_code, cancel_policy_snapshot, cancel_fee_percent_snapshot,
      cancel_fee_type_snapshot, cancel_fee_cents_snapshot
    ) VALUES
    (
      v_john_pro, v_client_uid, 'pending',
      (current_date + 3), '10:00', 90, 'home-improvement', 'plumbing-services',
      'SHOW-PEND-001', 'late_fee', 50, 'fixed', 2000
    ),
    (
      v_john_pro, v_client_uid, 'accepted',
      (current_date + 5), '14:00', 60, 'home-improvement', 'drain-cleaning',
      'SHOW-ACC-001', 'no_cancel', 50, 'percent', NULL
    ),
    (
      v_john_pro, v_client_uid, 'completed',
      (current_date - 8), '11:00', 90, 'home-improvement', 'water-heater-services',
      'SHOW-DONE-001', 'late_fee', 50, 'fixed', 2000
    );
  END IF;

  RAISE NOTICE 'Showcase ready. John pro_id=% Growth=% Starter=%', v_john_pro, v_growth_pro, v_starter_pro;
END $$;

-- Quick verify
SELECT u.email, p.business_name, p.subscription_tier, p.is_verified,
       (SELECT count(*) FROM pro_services s WHERE s.pro_profile_id = p.id) AS services,
       (SELECT plan_id FROM pro_subscriptions ps WHERE ps.user_id = p.user_id) AS plan_id
FROM pro_profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) IN (
  'johnpork23238@gmail.com',
  'premiereservicescontact@gmail.com',
  'bobjohnsongod@gmail.com'
)
ORDER BY p.subscription_tier;

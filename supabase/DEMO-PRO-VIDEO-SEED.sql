-- ============================================================
-- DEMO ACCOUNT SEED — for promotional / walkthrough video
-- ============================================================
-- Creates rich demo data for:
--   Pro:    demo.pro@premierservices.demo   /  DemoPro2026!
--   Client: demo.client@premierservices.demo / DemoClient2026!
--
-- SETUP (do this once in Supabase Dashboard → Authentication → Users):
--   1) Add user  demo.pro@premierservices.demo     password DemoPro2026!    (auto-confirm email)
--   2) Add user  demo.client@premierservices.demo  password DemoClient2026! (auto-confirm email)
--   3) Run THIS entire script in SQL Editor
--
-- SAFE TO RE-RUN: deletes previous demo rows for those emails, then re-inserts.
-- DO NOT use these logins in public ads as permanent credentials — rotate after filming
-- or keep them as a private demo-only pair.
-- ============================================================

DO $$
DECLARE
  v_pro_uid uuid;
  v_client_uid uuid;
  v_pro_id uuid;
  v_booking_done uuid;
  v_booking_done2 uuid;
  v_booking_pending uuid;
  v_booking_accepted uuid;
  v_job_id uuid;
  v_invoice jsonb;
BEGIN
  SELECT id INTO v_pro_uid FROM auth.users WHERE lower(email) = lower('demo.pro@premierservices.demo') LIMIT 1;
  SELECT id INTO v_client_uid FROM auth.users WHERE lower(email) = lower('demo.client@premierservices.demo') LIMIT 1;

  IF v_pro_uid IS NULL OR v_client_uid IS NULL THEN
    RAISE EXCEPTION
      'Create both Auth users first (Authentication → Users), then re-run. Missing: %',
      CASE
        WHEN v_pro_uid IS NULL AND v_client_uid IS NULL THEN 'demo.pro AND demo.client'
        WHEN v_pro_uid IS NULL THEN 'demo.pro@premierservices.demo'
        ELSE 'demo.client@premierservices.demo'
      END;
  END IF;

  -- Clean previous demo data (order matters for FKs)
  DELETE FROM public.payments
  WHERE booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.pro_profiles pp ON pp.id = b.pro_profile_id
    WHERE pp.user_id = v_pro_uid
  );
  DELETE FROM public.reviews WHERE reviewer_id IN (v_pro_uid, v_client_uid)
    OR pro_profile_id IN (SELECT id FROM public.pro_profiles WHERE user_id = v_pro_uid);
  DELETE FROM public.client_reviews
  WHERE pro_profile_id IN (SELECT id FROM public.pro_profiles WHERE user_id = v_pro_uid)
     OR client_id = v_client_uid;
  DELETE FROM public.job_quotes
  WHERE pro_profile_id IN (SELECT id FROM public.pro_profiles WHERE user_id = v_pro_uid)
     OR job_request_id IN (SELECT id FROM public.job_requests WHERE client_id = v_client_uid);
  DELETE FROM public.job_requests WHERE client_id = v_client_uid;
  DELETE FROM public.bookings
  WHERE client_id = v_client_uid
     OR pro_profile_id IN (SELECT id FROM public.pro_profiles WHERE user_id = v_pro_uid);
  DELETE FROM public.pro_services
  WHERE pro_profile_id IN (SELECT id FROM public.pro_profiles WHERE user_id = v_pro_uid);

  -- Profiles
  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language)
  VALUES (v_pro_uid, 'Alex Rivera', '514-555-0142', 'H2Y 1C6', 'en')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        postal_code = EXCLUDED.postal_code,
        updated_at = now();

  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language)
  VALUES (v_client_uid, 'Sam Chen', '514-555-0198', 'H3Z 2K4', 'en')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        postal_code = EXCLUDED.postal_code,
        updated_at = now();

  -- Pro profile (verified, Growth-looking demo)
  INSERT INTO public.pro_profiles (
    user_id, business_name, legal_business_name, bio, location,
    latitude, longitude, service_radius_km, phone, website,
    years_experience, is_verified, subscription_tier,
    primary_category_slug, price_min, price_max,
    availability, offers_travel, offers_workspace,
    gst_registration_number, qst_registration_number,
    page_header_text, page_primary_color
  )
  VALUES (
    v_pro_uid,
    'Rivera Home Services',
    'Rivera Home Services Inc.',
    'Licensed plumber & handyman serving downtown Montréal. Fast quotes, clear pricing, same-week availability.',
    'Montréal, QC',
    45.5017, -73.5673, 25,
    '514-555-0142',
    'https://premierservices.ca',
    8, true, 'growth',
    'home-improvement', 85, 160,
    'Mon–Sat · mornings & evenings',
    true, false,
    '123456789RT0001', '1234567890TQ0001',
    'Reliable local help, booked on Première',
    '#163a6b'
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
    subscription_tier = EXCLUDED.subscription_tier,
    primary_category_slug = EXCLUDED.primary_category_slug,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    availability = EXCLUDED.availability,
    offers_travel = EXCLUDED.offers_travel,
    gst_registration_number = EXCLUDED.gst_registration_number,
    qst_registration_number = EXCLUDED.qst_registration_number,
    page_header_text = EXCLUDED.page_header_text,
    page_primary_color = EXCLUDED.page_primary_color,
    updated_at = now()
  RETURNING id INTO v_pro_id;

  IF v_pro_id IS NULL THEN
    SELECT id INTO v_pro_id FROM public.pro_profiles WHERE user_id = v_pro_uid;
  END IF;

  INSERT INTO public.pro_services (pro_profile_id, category_slug, service_slug, display_name, custom_price_min, custom_price_max, duration_minutes, description)
  VALUES
    (v_pro_id, 'home-improvement', 'plumbing-services', 'Plumbing', 95, 180, 90, 'Leaks, installs, drain clearing'),
    (v_pro_id, 'home-improvement', 'electrical-services', 'Electrical basics', 110, 200, 120, 'Fixtures, outlets, troubleshooting'),
    (v_pro_id, 'home-improvement', 'handyman-services', 'Handyman', 85, 150, 60, 'Mounting, small repairs, assembly')
  ON CONFLICT DO NOTHING;

  -- Fallback if unique constraint name differs
  IF NOT EXISTS (SELECT 1 FROM public.pro_services WHERE pro_profile_id = v_pro_id) THEN
    INSERT INTO public.pro_services (pro_profile_id, category_slug, service_slug, display_name, custom_price_min, custom_price_max, duration_minutes, description)
    VALUES
      (v_pro_id, 'home-improvement', 'plumbing-services', 'Plumbing', 95, 180, 90, 'Leaks, installs, drain clearing'),
      (v_pro_id, 'home-improvement', 'electrical-services', 'Electrical basics', 110, 200, 120, 'Fixtures, outlets, troubleshooting'),
      (v_pro_id, 'home-improvement', 'handyman-services', 'Handyman', 85, 150, 60, 'Mounting, small repairs, assembly');
  END IF;

  v_invoice := jsonb_build_object(
    'business_name', 'Rivera Home Services Inc.',
    'client_name', 'Sam Chen',
    'service_label', 'Kitchen faucet repair',
    'subtotal_cents', 12000,
    'gst_cents', 600,
    'qst_cents', 1195,
    'total_cents', 13795,
    'currency', 'CAD',
    'issued_at', (now() - interval '12 days')::text,
    'line_items', jsonb_build_array(
      jsonb_build_object('label', 'Labour (1.5 hr)', 'amount_cents', 9500),
      jsonb_build_object('label', 'Parts / supplies', 'amount_cents', 2500)
    )
  );

  -- Completed booking + receipt
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    responded_at, invoice_snapshot, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'completed',
    (current_date - 12), '10:00',
    90, 'home-improvement', 'plumbing-services',
    now() - interval '13 days',
    v_invoice,
    'PRM-DEMO-001'
  ) RETURNING id INTO v_booking_done;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, status,
    square_payment_id, card_brand, card_last_4, idempotency_key
  ) VALUES (
    v_booking_done, v_pro_id, 13795, 'CAD', 'completed',
    'demo_pay_001', 'visa', '4242', 'demo-idem-001'
  );

  -- Second completed job (for richer history)
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    responded_at, invoice_snapshot, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'completed',
    (current_date - 5), '14:30',
    60, 'home-improvement', 'handyman-services',
    now() - interval '6 days',
    jsonb_build_object(
      'business_name', 'Rivera Home Services Inc.',
      'client_name', 'Sam Chen',
      'service_label', 'TV wall mount',
      'subtotal_cents', 9000,
      'gst_cents', 450,
      'qst_cents', 896,
      'total_cents', 10346,
      'currency', 'CAD',
      'issued_at', (now() - interval '5 days')::text
    ),
    'PRM-DEMO-002'
  ) RETURNING id INTO v_booking_done2;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, status,
    square_payment_id, card_brand, card_last_4, idempotency_key
  ) VALUES (
    v_booking_done2, v_pro_id, 10346, 'CAD', 'completed',
    'demo_pay_002', 'mastercard', '4444', 'demo-idem-002'
  );

  -- Accepted upcoming
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug, responded_at, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'accepted',
    (current_date + 3), '09:00',
    120, 'home-improvement', 'electrical-services',
    now() - interval '1 day', 'PRM-DEMO-003'
  ) RETURNING id INTO v_booking_accepted;

  -- Pending request (so pro can show Accept / Decline on camera)
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'pending',
    (current_date + 7), '16:00',
    90, 'home-improvement', 'plumbing-services', 'PRM-DEMO-004'
  ) RETURNING id INTO v_booking_pending;

  -- Client → pro reviews (stars on pro profile)
  INSERT INTO public.reviews (pro_profile_id, reviewer_id, rating, title, content, created_at)
  VALUES
    (v_pro_id, v_client_uid, 5, 'Fixed the leak same day',
     'Alex showed up on time, explained the fix clearly, and the faucet works perfectly. Easy to book on Première.',
     now() - interval '10 days'),
    (v_pro_id, v_client_uid, 5, 'Clean work, fair price',
     'Mounted the TV and cleaned up after. Booking + receipt were all in the app — felt professional.',
     now() - interval '3 days');

  -- Pro → client review
  INSERT INTO public.client_reviews (pro_profile_id, client_id, booking_id, rating, content, created_at)
  VALUES (
    v_pro_id, v_client_uid, v_booking_done, 5,
    'Great client — clear photos of the issue, home ready when I arrived, paid promptly.',
    now() - interval '9 days'
  );

  -- Open job request + quote (marketplace lead story)
  INSERT INTO public.job_requests (
    client_id, description, category, postal_code, city, province,
    latitude, longitude, budget_range, timing, status, preferred_date, preferred_time_window
  ) VALUES (
    v_client_uid,
    'Bathroom sink is draining slowly and gurgles. Need a plumber this week if possible.',
    'Plumbing',
    'H3Z 2K4', 'Westmount', 'QC',
    45.4804, -73.5947,
    '$100–200', 'This week', 'open',
    current_date + 4, 'Morning'
  ) RETURNING id INTO v_job_id;

  INSERT INTO public.job_quotes (
    job_request_id, pro_profile_id, price_cents, estimated_time, message, status
  ) VALUES (
    v_job_id, v_pro_id, 14500, 'About 1–1.5 hours',
    'I can come Thursday morning, bring a snake and replace the P-trap if needed. Parts included up to $25.',
    'sent'
  );

  RAISE NOTICE 'Demo seed OK. Pro UID=%, Client UID=%, Pro profile=%', v_pro_uid, v_client_uid, v_pro_id;
  RAISE NOTICE 'Login pro: demo.pro@premierservices.demo / DemoPro2026!';
  RAISE NOTICE 'Login client: demo.client@premierservices.demo / DemoClient2026!';
END $$;

I need you to audit this codebase and produce a structured report I'll use to fill in a Privacy Policy required under Quebec's Law 25 (P-39.1). Don't write the policy itself — just extract and report facts from the actual code. Output as a markdown file. Be exhaustive; if something isn't found, say "NOT FOUND IN CODE" rather than guessing or assuming a default.

For each item below, cite the file(s)/table(s)/function(s) where you found the answer.

## 1. Legal entity & contacts
- Any hardcoded business/legal entity name, registered address, or business number anywhere in the codebase (env vars, config, footer, Terms page, invoice templates)
- Every support/contact email address referenced in the code (support@, privacy@, admin allowlist emails, etc.) and what each is used for

## 2. Data inventory
- List every Supabase/Postgres table that stores personal information about a user (client or pro), with: table name, each personal-data column, and what triggers a row being created
- Every Storage bucket, whether it's public or private, and what type of file goes in it
- Any place personal data is duplicated or cached outside the main DB (localStorage keys, browser cookies, client-side state, logs)

## 3. Retention & deletion
- Any code that deletes, expires, or archives personal data automatically (cron jobs, TTL fields, scheduled Edge Functions, DB triggers)
- Whether there is ANY account-deletion flow (self-serve or admin-triggered) — trace what it actually deletes vs. what it leaves behind
- Whether ID images (client or pro) are ever deleted, and under what condition — or confirm they're kept indefinitely

## 4. Third-party data flows (for Law 25 s.17 cross-border transfer review)
- Every external API/service call that sends personal data off-platform: Supabase (confirm hosting region if visible in config), Square, Google Maps/Places/Geocoding, the AI chat provider (Hugging Face/other), Resend, Twilio — for each, what specific personal data fields get sent to them
- Any Data Processing Agreement, DPA, or privacy-related terms referenced/linked anywhere in the code or config

## 5. AI / automated systems
- The exact system prompt or instructions given to the support AI (ai-chat-hf or equivalent Edge Function)
- Whether/where the UI discloses to the user that they're talking to an AI, not a human
- Whether AI chat conversations are logged/stored anywhere, and for how long
- Any automated ranking, scoring, or filtering logic that affects what a client sees (pro search order, "top picks," etc.) and what inputs drive it

## 6. Consent & acceptance logging
- How/where Terms of Service acceptance is recorded for clients vs. pros (DB column, timestamp, version, IP — or confirm none of this is logged)
- How/where cancellation-policy acceptance at booking is recorded, and whether the policy text itself is snapshotted on the booking row or just referenced live

## 7. Cookies & tracking
- Every cookie or localStorage key set by the app, what each one stores, and whether it's essential (session/auth) or preference/tracking
- Any existing cookie-consent banner code — what it actually does when a user declines

## 8. Security posture (for the "Security" section of the policy — needs to be accurate, not aspirational)
- Current RLS policy list for every table containing personal data (policy name + roles it applies to)
- Every Edge Function and whether verify_jwt is true or false for each
- Whether MFA is enforced anywhere, especially for admin/platform_admin accounts
- Encryption: confirm what's encrypted at rest vs. in transit vs. neither, as far as the code/config shows

## 9. Minors / age
- Any age-gating logic at signup (or confirm there is none beyond a Terms checkbox)

Output everything as a single markdown report organized by these 9 sections, with file paths/table names cited inline. This will go directly into a legal document, so precision matters more than completeness of prose — short factual bullets are better than explanations.-- ==============================================================================
-- PREMIÈRE SERVICES — ADVERTISING & CLIENT SHOWCASE SEED SCRIPT
-- ==============================================================================
-- Sets up 2 isolated demo accounts for filming promotional videos, walkthroughs,
-- and live presentations to prospective clients:
--
--   1. PRO ACCOUNT:
--      Email:    demo.pro@premierservices.demo
--      Password: DemoPro2026!
--      Name:     Alex Rivera (Rivera Home Services)
--      Role:     Verified Pro (Growth tier, full dashboard, custom services, quotes)
--
--   2. CLIENT ACCOUNT:
--      Email:    demo.client@premierservices.demo
--      Password: DemoClient2026!
--      Name:     Sam Chen
--      Role:     Client (ready to book, post jobs, accept quotes, review)
--
-- KEY SAFETY FEATURES:
--   - ZERO real credit cards needed (simulated 1-click test authorization built in).
--   - ZERO Square Connect merchant credentials needed for the mock pro.
--   - ZERO SMS or external Twilio charges (notifications automatically bypass demo).
--   - Hidden from general public directory search so real clients won't book them.
--   - Re-runnable anytime: resets the demo dataset back to a clean, pristine state.
--
-- HOW TO RUN:
--   1) Open Supabase Dashboard → SQL Editor
--   2) Paste this entire file and click "Run"
--   3) If your Supabase instance prevents direct auth.users creation via SQL:
--      Go to Authentication → Users → "Add user":
--        - demo.pro@premierservices.demo    / DemoPro2026!   (Auto Confirm: ON)
--        - demo.client@premierservices.demo / DemoClient2026! (Auto Confirm: ON)
--      Then re-run this SQL script.
-- ==============================================================================

DO $$
DECLARE
  v_pro_uid uuid;
  v_client_uid uuid;
  v_pro_id uuid;
  v_booking_done uuid;
  v_booking_accepted uuid;
  v_booking_pending uuid;
  v_job_id uuid;
  v_invoice jsonb;
BEGIN

  -- 1. Try to fetch existing auth users
  SELECT id INTO v_pro_uid FROM auth.users WHERE lower(email) = lower('demo.pro@premierservices.demo') LIMIT 1;
  SELECT id INTO v_client_uid FROM auth.users WHERE lower(email) = lower('demo.client@premierservices.demo') LIMIT 1;

  -- 2. If missing, attempt automatic creation in auth.users
  IF v_pro_uid IS NULL THEN
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'demo.pro@premierservices.demo',
        crypt('DemoPro2026!', gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Alex Rivera", "email": "demo.pro@premierservices.demo"}'::jsonb,
        now(),
        now()
      ) RETURNING id INTO v_pro_uid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_client_uid IS NULL THEN
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'demo.client@premierservices.demo',
        crypt('DemoClient2026!', gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Sam Chen", "email": "demo.client@premierservices.demo"}'::jsonb,
        now(),
        now()
      ) RETURNING id INTO v_client_uid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Re-query if just created
  IF v_pro_uid IS NULL THEN
    SELECT id INTO v_pro_uid FROM auth.users WHERE lower(email) = lower('demo.pro@premierservices.demo') LIMIT 1;
  END IF;
  IF v_client_uid IS NULL THEN
    SELECT id INTO v_client_uid FROM auth.users WHERE lower(email) = lower('demo.client@premierservices.demo') LIMIT 1;
  END IF;

  IF v_pro_uid IS NULL OR v_client_uid IS NULL THEN
    RAISE EXCEPTION
      'Please create both users first in Supabase Dashboard -> Authentication -> Users (with Auto-confirm Email turned ON):
       1) demo.pro@premierservices.demo    (Password: DemoPro2026!)
       2) demo.client@premierservices.demo (Password: DemoClient2026!)
       Then run this script again.';
  END IF;

  -- 3. Clean previous demo rows (enables clean re-runs)
  DELETE FROM public.payments
  WHERE booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.pro_profiles pp ON pp.id = b.pro_profile_id
    WHERE pp.user_id = v_pro_uid
  );

  DELETE FROM public.reviews
  WHERE reviewer_id IN (v_pro_uid, v_client_uid)
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

  DELETE FROM public.pro_subscriptions WHERE user_id = v_pro_uid;

  -- 4. Set Profiles (with realistic Canadian contact & invoice info)
  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, address, email_language)
  VALUES (
    v_pro_uid,
    'Alex Rivera',
    '514-555-0142',
    'H2Y 1C6',
    '1000 Rue de la Gauchetière O, Montréal, QC H3B 4W5',
    'en'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    postal_code = EXCLUDED.postal_code,
    address = EXCLUDED.address,
    email_language = EXCLUDED.email_language,
    updated_at = now();

  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, address, email_language)
  VALUES (
    v_client_uid,
    'Sam Chen',
    '514-555-0198',
    'H3Z 2K4',
    '1155 René-Lévesque Blvd W, Montréal, QC H3B 2V6',
    'en'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    postal_code = EXCLUDED.postal_code,
    address = EXCLUDED.address,
    email_language = EXCLUDED.email_language,
    updated_at = now();

  -- 5. Pro Profile (Verified, Growth Tier)
  INSERT INTO public.pro_profiles (
    user_id, business_name, legal_business_name, bio, location,
    business_address, latitude, longitude, service_radius_km, phone, website,
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
    'Licensed plumbing & home maintenance specialist in Montréal. Fast response, clear upfront quotes, same-week availability.',
    'Montréal, QC',
    '1000 Rue de la Gauchetière O, Montréal, QC H3B 4W5',
    45.5017, -73.5673, 25,
    '514-555-0142',
    'https://premiereservices.ca',
    8, true, 'growth',
    'home-improvement', 85.00, 160.00,
    'Mon–Sat · mornings & afternoons',
    true, false,
    '123456789RT0001', '1234567890TQ0001',
    'Reliable local home services, booked on Première',
    '#163a6b'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    legal_business_name = EXCLUDED.legal_business_name,
    bio = EXCLUDED.bio,
    location = EXCLUDED.location,
    business_address = EXCLUDED.business_address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    service_radius_km = EXCLUDED.service_radius_km,
    phone = EXCLUDED.phone,
    years_experience = EXCLUDED.years_experience,
    is_verified = true,
    subscription_tier = 'growth',
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

  -- Active subscription record for the pro (matches schema: user_id, plan_id, billing_start, billing_cycle_days, updated_at)
  INSERT INTO public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
  VALUES (v_pro_uid, 'growth', now() - interval '30 days', 30, now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = 'growth',
    billing_start = EXCLUDED.billing_start,
    billing_cycle_days = 30,
    updated_at = now();

  -- 6. Initial Services (Pro can edit, remove, or add new services anytime in Dashboard)
  INSERT INTO public.pro_services (
    pro_profile_id, category_slug, service_slug, display_name,
    custom_price_min, custom_price_max, duration_minutes, description
  ) VALUES
    (
      v_pro_id, 'home-improvement', 'plumbing-services', 'Plumbing & Leaks Repair',
      95.00, 180.00, 90,
      'Faucet repair, pipe leak diagnosis, valve replacements, drain unclogging.'
    ),
    (
      v_pro_id, 'home-improvement', 'electrical-services', 'Electrical Fixtures & Outlets',
      110.00, 200.00, 120,
      'Ceiling lights, dimmer switches, GFCI outlets, basic diagnostic.'
    ),
    (
      v_pro_id, 'home-improvement', 'handyman-services', 'General Handyman & Assembly',
      85.00, 150.00, 60,
      'TV wall mounting, shelving installation, door handle repair, minor fixes.'
    );

  -- 7. Sample Invoice Snapshot for Completed Booking
  v_invoice := jsonb_build_object(
    'business_name', 'Rivera Home Services Inc.',
    'client_name', 'Sam Chen',
    'service_label', 'Kitchen Faucet Repair',
    'subtotal_cents', 12000,
    'gst_cents', 600,
    'qst_cents', 1195,
    'total_cents', 13795,
    'currency', 'CAD',
    'issued_at', (now() - interval '10 days')::text,
    'line_items', jsonb_build_array(
      jsonb_build_object('label', 'Labour (1.5 hr)', 'amount_cents', 9500),
      jsonb_build_object('label', 'Replacement cartridge & seals', 'amount_cents', 2500)
    )
  );

  -- Completed booking with receipt
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    responded_at, invoice_snapshot, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'completed',
    (current_date - 10), '10:00',
    90, 'home-improvement', 'plumbing-services',
    now() - interval '11 days',
    v_invoice,
    'PRM-DEMO-001'
  ) RETURNING id INTO v_booking_done;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, status,
    square_payment_id, card_brand, card_last_4, idempotency_key
  ) VALUES (
    v_booking_done, v_pro_id, 13795, 'CAD', 'completed',
    'demo_sq_pay_001', 'visa', '4242', 'demo-idemp-001'
  );

  -- Accepted upcoming booking
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    responded_at, public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'accepted',
    (current_date + 3), '14:00',
    60, 'home-improvement', 'handyman-services',
    now() - interval '1 day',
    'PRM-DEMO-002'
  ) RETURNING id INTO v_booking_accepted;

  -- Pending booking request (so Pro can demonstrate clicking "Accept" or "Decline" on camera)
  INSERT INTO public.bookings (
    pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code
  ) VALUES (
    v_pro_id, v_client_uid, 'pending',
    (current_date + 6), '09:30',
    120, 'home-improvement', 'electrical-services',
    'PRM-DEMO-003'
  ) RETURNING id INTO v_booking_pending;

  -- 8. Client Review & Pro Response (showcases reviews & trust rating)
  INSERT INTO public.reviews (
    pro_profile_id, reviewer_id, rating, title, content, created_at
  ) VALUES (
    v_pro_id, v_client_uid, 5,
    'Fast response, very clean work',
    'Alex arrived right on time, explained the issue with our kitchen faucet, and had it fixed within an hour. Excellent experience booking through Première Services!',
    now() - interval '9 days'
  );

  INSERT INTO public.review_responses (
    review_id, pro_user_id, content, created_at
  ) VALUES (
    (SELECT id FROM public.reviews WHERE pro_profile_id = v_pro_id LIMIT 1),
    v_pro_uid,
    'Thank you Sam! Glad we could get that taken care of for you quickly. Reach out anytime!',
    now() - interval '8 days'
  );

  -- 9. Active Job Request and Pro Quote (showcases "Post a job" & quoting workflow)
  INSERT INTO public.job_requests (
    client_id, category, description, postal_code, city, province,
    latitude, longitude, budget_range, timing, status, preferred_date, preferred_time_window
  ) VALUES (
    v_client_uid,
    'Plumbing',
    'Bathroom sink pipe repair & faucet installation. Looking for someone to replace the drain assembly and install a new single-handle faucet this week in downtown Montréal.',
    'H3Z 2K4',
    'Montréal',
    'QC',
    45.4804,
    -73.5947,
    '$100–200',
    'This week',
    'open',
    current_date + 4,
    'morning'
  ) RETURNING id INTO v_job_id;

  INSERT INTO public.job_quotes (
    job_request_id, pro_profile_id, price_cents, estimated_time, message, status
  ) VALUES (
    v_job_id,
    v_pro_id,
    14000,
    'About 1.5 hours',
    'Hi Sam! I have standard P-trap and supply lines in my van. I can stop by Wednesday morning at 10:00 AM to install it for you.',
    'pending'
  );

  RAISE NOTICE 'Première Services showcase accounts created successfully!';
  RAISE NOTICE 'Pro login:    demo.pro@premierservices.demo    / DemoPro2026!';
  RAISE NOTICE 'Client login: demo.client@premierservices.demo / DemoClient2026!';

END $$;

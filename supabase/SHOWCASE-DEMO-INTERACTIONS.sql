-- ============================================================
-- DEMO INTERACTIONS — johnpork (pro) × caronmellie (client)
-- Safe to re-run: deletes prior DEMO-* rows for this pair first.
-- ============================================================
-- 6 bookings:
--   SAT-1  completed + 5★ review + payment + renewal + auto-reply  (satisfied)
--   SAT-2  completed + pro→client review + invoice                 (satisfied)
--   SAT-3  cancelled FREE (no fee) — incomplete happy cancel       (satisfied)
--   DIS-1  completed + mild claim (issue) pending                  (dissatisfied)
--   DIS-2  completed + refund claim reviewed                       (dissatisfied)
--   DIS-3  cancelled WITH late fee — incomplete                    (dissatisfied)
-- Plus: saved pro, open job request + quote, plumbing services.
-- ============================================================

DO $$
DECLARE
  v_pro_uid uuid;
  v_client_uid uuid;
  v_pro_id uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_b3 uuid;
  v_b4 uuid;
  v_b5 uuid;
  v_b6 uuid;
  v_review_id uuid;
  v_job_id uuid;
BEGIN
  SELECT id INTO v_pro_uid FROM auth.users WHERE lower(email) = lower('johnpork23238@gmail.com') LIMIT 1;
  SELECT id INTO v_client_uid FROM auth.users WHERE lower(email) = lower('caronmellie@gmail.com') LIMIT 1;

  IF v_pro_uid IS NULL THEN
    RAISE EXCEPTION 'Auth user johnpork23238@gmail.com not found';
  END IF;
  IF v_client_uid IS NULL THEN
    RAISE EXCEPTION 'Auth user caronmellie@gmail.com not found — create the account first';
  END IF;

  -- Profiles
  INSERT INTO public.profiles (user_id, full_name, phone, postal_code, email_language, address)
  VALUES
    (v_pro_uid, 'John Pork', '514-555-2300', 'H2Y 1C6', 'fr', '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6'),
    (v_client_uid, 'Mellie Caron', '514-555-8800', 'H3Z 2K4', 'fr', '450 Av. Greene, Westmount, QC H3Z 2K4')
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    postal_code = EXCLUDED.postal_code,
    email_language = EXCLUDED.email_language,
    address = EXCLUDED.address,
    updated_at = now();

  -- Pro profile (upsert)
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
    v_pro_uid,
    'Pork Plomberie Pro (Demo)',
    'Pork Plomberie Inc.',
    'Démo PRO × client Mellie : réservations, annulations, avis, réclamations, soumissions.',
    'Montréal, QC',
    45.5017, -73.5673, 30,
    '514-555-2300', 'https://www.premiereservices.ca',
    12, true, 'pro',
    'home-improvement', 75, 220,
    'Lun–Ven 9:00–17:00 · Sam 9:00–15:00',
    true, true, false,
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
    '123456789RT0001', '1234567890TQ0001',
    'Démo interactions client',
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
    primary_category_slug = 'home-improvement',
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    availability = EXCLUDED.availability,
    offers_travel = true,
    offers_workspace = true,
    business_address = EXCLUDED.business_address,
    page_header_text = EXCLUDED.page_header_text,
    booking_cancel_policy = 'late_fee',
    booking_cancel_fee_percent = 50,
    referral_invite_panel_enabled = true,
    updated_at = now()
  RETURNING id INTO v_pro_id;

  IF v_pro_id IS NULL THEN
    SELECT id INTO v_pro_id FROM public.pro_profiles WHERE user_id = v_pro_uid;
  END IF;

  DELETE FROM public.pro_subscriptions WHERE user_id = v_pro_uid;
  INSERT INTO public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
  VALUES (v_pro_uid, 'pro', now() - interval '20 days', 30, now());

  -- Services with varied cancel policies
  DELETE FROM public.pro_services WHERE pro_profile_id = v_pro_id;
  INSERT INTO public.pro_services (
    pro_profile_id, category_slug, service_slug, display_name,
    custom_price_min, custom_price_max, duration_minutes, description,
    auto_reply_message, renewal_interval_months, location_mode,
    workspace_address, workspace_latitude, workspace_longitude,
    cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents
  ) VALUES
  (
    v_pro_id, 'home-improvement', 'plumbing-services', 'Plomberie express',
    95, 95, 90, 'Fuites, robinets, toilettes — démo.',
    'Merci Mellie — je confirme sous 2 h.', 12, 'both',
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6', 45.503, -73.558,
    'late_fee', 'fixed', 50, 2500
  ),
  (
    v_pro_id, 'home-improvement', 'drain-cleaning', 'Débouchage de drains',
    120, 120, 90, 'Drains cuisine/salle de bain.',
    'Reçu — créneau sous peu.', NULL, 'travel',
    NULL, NULL, NULL,
    'free', 'percent', 50, 0
  ),
  (
    v_pro_id, 'home-improvement', 'water-heater-services', 'Chauffe-eau',
    175, 175, 180, 'Installation / entretien chauffe-eau.',
    NULL, 6, 'workspace',
    '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6', 45.503, -73.558,
    'late_fee', 'percent', 50, 0
  ),
  (
    v_pro_id, 'home-improvement', 'bathroom-remodel', 'Plomberie salle de bain',
    200, 200, 120, 'Robinets, toilette, douche.',
    NULL, NULL, 'travel',
    NULL, NULL, NULL,
    'no_cancel', 'percent', 50, 0
  );

  INSERT INTO public.pro_licenses (pro_profile_id, license_number, license_type, holder_name, is_verified)
  SELECT v_pro_id, 'RBQ-DEMO-JP-001', 'RBQ', 'Pork Plomberie Inc.', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pro_licenses WHERE pro_profile_id = v_pro_id AND license_number = 'RBQ-DEMO-JP-001'
  );

  -- Wipe prior demo rows for this pair
  DELETE FROM public.booking_claim_requests
  WHERE client_id = v_client_uid AND pro_profile_id = v_pro_id
    AND booking_id IN (SELECT id FROM public.bookings WHERE public_booking_code LIKE 'DEMO-%');

  DELETE FROM public.payments
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE public_booking_code LIKE 'DEMO-%');

  DELETE FROM public.client_reviews
  WHERE client_id = v_client_uid AND pro_profile_id = v_pro_id
    AND booking_id IN (SELECT id FROM public.bookings WHERE public_booking_code LIKE 'DEMO-%');

  DELETE FROM public.review_responses
  WHERE review_id IN (
    SELECT r.id FROM public.reviews r
    WHERE r.pro_profile_id = v_pro_id AND r.reviewer_id = v_client_uid
  );

  DELETE FROM public.reviews
  WHERE pro_profile_id = v_pro_id AND reviewer_id = v_client_uid;

  DELETE FROM public.bookings
  WHERE pro_profile_id = v_pro_id AND client_id = v_client_uid
    AND public_booking_code LIKE 'DEMO-%';

  DELETE FROM public.job_quotes
  WHERE pro_profile_id = v_pro_id
    AND job_request_id IN (
      SELECT id FROM public.job_requests
      WHERE client_id = v_client_uid AND description LIKE 'DEMO:%'
    );

  DELETE FROM public.job_requests
  WHERE client_id = v_client_uid AND description LIKE 'DEMO:%';

  DELETE FROM public.client_saved_pros
  WHERE user_id = v_client_uid AND pro_profile_id = v_pro_id;

  -- ---------- 1 SAT complete + review ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at, auto_reply_snapshot,
    client_renews_annually, renewal_interval_months_snapshot, renewal_anchor_date,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, invoice_number, invoice_snapshot,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'completed',
    (current_date - 18), '10:00', 90,
    'home-improvement', 'plumbing-services',
    'DEMO-SAT-DONE-5',
    now() - interval '18 days', 'Merci Mellie — je confirme sous 2 h.',
    true, 12, (current_date - 18),
    'travel', 4.2, 12,
    'late_fee', 50, 'fixed', 2500,
    now() - interval '19 days',
    910001,
    jsonb_build_object(
      'demo', true,
      'label', 'Satisfied complete — 5★',
      'service', 'Plomberie express',
      'subtotal_cents', 9500,
      'tax_cents', 1421,
      'total_cents', 10921,
      'currency', 'CAD'
    ),
    false, false, now() - interval '19 days'
  ) RETURNING id INTO v_b1;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, square_payment_id, status, idempotency_key, card_brand, card_last_4
  ) VALUES (
    v_b1, v_pro_id, 10921, 'CAD', 'demo_sq_sat1', 'completed', 'demo-sat-done-5', 'VISA', '4242'
  );

  INSERT INTO public.reviews (pro_profile_id, reviewer_id, rating, title, content)
  VALUES (
    v_pro_id, v_client_uid, 5, 'Excellent travail',
    'Fuite réparée rapidement, pro ponctuel et propre. Je renouvelle l’entretien annuel.'
  ) RETURNING id INTO v_review_id;

  INSERT INTO public.review_responses (review_id, pro_user_id, content)
  VALUES (v_review_id, v_pro_uid, 'Merci Mellie ! Au plaisir de l’entretien l’an prochain.');

  -- ---------- 2 SAT complete + client review from pro ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at, auto_reply_snapshot,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, invoice_number, invoice_snapshot,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'completed',
    (current_date - 10), '14:00', 90,
    'home-improvement', 'drain-cleaning',
    'DEMO-SAT-DONE-OK',
    now() - interval '10 days', 'Reçu — créneau sous peu.',
    'travel', 3.8, 11,
    'free', 50, 'percent', 0,
    now() - interval '11 days',
    910002,
    jsonb_build_object(
      'demo', true,
      'label', 'Satisfied complete — clear drain',
      'service', 'Débouchage',
      'subtotal_cents', 12000,
      'tax_cents', 1794,
      'total_cents', 13794,
      'currency', 'CAD'
    ),
    false, false, now() - interval '11 days'
  ) RETURNING id INTO v_b2;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, square_payment_id, status, idempotency_key, card_brand, card_last_4
  ) VALUES (
    v_b2, v_pro_id, 13794, 'CAD', 'demo_sq_sat2', 'completed', 'demo-sat-done-ok', 'MASTERCARD', '4444'
  );

  INSERT INTO public.client_reviews (pro_profile_id, client_id, booking_id, rating, content)
  VALUES (v_pro_id, v_client_uid, v_b2, 5, 'Cliente claire et prête à l’heure — parfait.');

  -- ---------- 3 SAT cancel FREE (incomplete) ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at, auto_reply_snapshot,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, decline_reason,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'cancelled',
    (current_date + 4), '09:00', 90,
    'home-improvement', 'drain-cleaning',
    'DEMO-SAT-CANCEL-FREE',
    now() - interval '2 days', 'Reçu — créneau sous peu.',
    'travel', 3.8, 11,
    'free', 50, 'percent', 0,
    now() - interval '2 days',
    'Client cancelled early — no fee (free cancel policy). Plans changed; still happy with pro.',
    false, true, now() - interval '3 days'
  ) RETURNING id INTO v_b3;

  -- ---------- 4 DIS complete mild claim ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, invoice_number, invoice_snapshot,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'completed',
    (current_date - 7), '11:00', 120,
    'home-improvement', 'bathroom-remodel',
    'DEMO-DIS-MILD',
    now() - interval '7 days',
    'travel', 5.1, 15,
    'no_cancel', 50, 'percent', 0,
    now() - interval '8 days',
    910004,
    jsonb_build_object(
      'demo', true,
      'label', 'Dissatisfied mild — quality follow-up',
      'service', 'Plomberie salle de bain',
      'subtotal_cents', 20000,
      'tax_cents', 2990,
      'total_cents', 22990,
      'currency', 'CAD'
    ),
    true, false, now() - interval '8 days'
  ) RETURNING id INTO v_b4;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, square_payment_id, status, idempotency_key, card_brand, card_last_4
  ) VALUES (
    v_b4, v_pro_id, 22990, 'CAD', 'demo_sq_dis1', 'completed', 'demo-dis-mild', 'VISA', '1111'
  );

  INSERT INTO public.booking_claim_requests (
    booking_id, client_id, pro_profile_id, claim_type, message, status,
    dispute_category, issue_category, workflow_status, investigation_notes
  ) VALUES (
    v_b4, v_client_uid, v_pro_id, 'issue',
    'Le joint du robinet goutte encore un peu après la visite. Pas urgent, mais j’aimerais une retouche.',
    'pending',
    'incomplete_service', 'quality', 'open',
    'Demo mild dissatisfaction — pending review'
  );

  -- ---------- 5 DIS complete severe refund claim ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, invoice_number, invoice_snapshot,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'completed',
    (current_date - 14), '13:00', 180,
    'home-improvement', 'water-heater-services',
    'DEMO-DIS-REFUND',
    now() - interval '14 days',
    'workspace', 6.0, 18,
    'late_fee', 50, 'percent', 0,
    now() - interval '15 days',
    910005,
    jsonb_build_object(
      'demo', true,
      'label', 'Dissatisfied severe — refund claim',
      'service', 'Chauffe-eau',
      'subtotal_cents', 17500,
      'tax_cents', 2616,
      'total_cents', 20116,
      'currency', 'CAD'
    ),
    false, false, now() - interval '15 days'
  ) RETURNING id INTO v_b5;

  INSERT INTO public.payments (
    booking_id, pro_profile_id, amount_cents, currency, square_payment_id, status, idempotency_key, card_brand, card_last_4
  ) VALUES (
    v_b5, v_pro_id, 20116, 'CAD', 'demo_sq_dis2', 'completed', 'demo-dis-refund', 'AMEX', '0005'
  );

  INSERT INTO public.booking_claim_requests (
    booking_id, client_id, pro_profile_id, claim_type, message, status,
    admin_resolution, dispute_category, issue_category, workflow_status,
    investigation_notes, resolution_summary, refund_amount_cents, reperformance_status
  ) VALUES (
    v_b5, v_client_uid, v_pro_id, 'refund',
    'Le chauffe-eau fuit encore 48 h après. Eau au sol, inquiet pour les dégâts. Demande de remboursement partiel.',
    'reviewed',
    'refunded',
    'visible_damage', 'safety', 'resolved',
    'Demo severe dissatisfaction — admin reviewed',
    'Partial refund approved for demo walkthrough',
    10058, 'not_applicable'
  );

  -- ---------- 6 DIS cancel WITH FEE (incomplete) ----------
  INSERT INTO public.bookings (
    id, pro_profile_id, client_id, status, preferred_date, preferred_time,
    service_duration_minutes, service_category_slug, service_slug,
    public_booking_code, responded_at, auto_reply_snapshot,
    service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
    cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
    cancel_policy_acknowledged_at, decline_reason,
    client_unread, pro_unread, created_at
  ) VALUES (
    gen_random_uuid(), v_pro_id, v_client_uid, 'cancelled',
    (current_date + 1), '16:00', 90,
    'home-improvement', 'plumbing-services',
    'DEMO-DIS-CANCEL-FEE',
    now() - interval '1 day', 'Merci Mellie — je confirme sous 2 h.',
    'travel', 4.2, 12,
    'late_fee', 50, 'fixed', 2500,
    now() - interval '20 hours',
    'Client cancelled <24h — late fee $25.00 (fixed). Dissatisfied with scheduling conflict.',
    true, true, now() - interval '2 days'
  ) RETURNING id INTO v_b6;

  INSERT INTO public.booking_claim_requests (
    booking_id, client_id, pro_profile_id, claim_type, message, status,
    dispute_category, issue_category, workflow_status
  ) VALUES (
    v_b6, v_client_uid, v_pro_id, 'issue',
    'Je conteste les frais d’annulation de 25 $. J’ai dû annuler pour une urgence familiale.',
    'pending',
    'unauthorized_charges', 'cancellation_fee', 'open'
  );

  -- Saved pro + open job request / quote (marketplace features)
  INSERT INTO public.client_saved_pros (user_id, pro_profile_id)
  VALUES (v_client_uid, v_pro_id)
  ON CONFLICT (user_id, pro_profile_id) DO NOTHING;

  INSERT INTO public.job_requests (
    client_id, description, category, postal_code, city, province,
    latitude, longitude, budget_range, timing, status, preferred_date
  ) VALUES (
    v_client_uid,
    'DEMO: Fuite sous l’évier de cuisine — besoin d’une soumission cette semaine.',
    'Plumbing',
    'H3Z 2K4', 'Westmount', 'QC',
    45.485, -73.597,
    '100-150', 'This week', 'open',
    (current_date + 6)
  ) RETURNING id INTO v_job_id;

  INSERT INTO public.job_quotes (
    job_request_id, pro_profile_id, price_cents, estimated_time, message, status
  ) VALUES (
    v_job_id, v_pro_id, 12500, '90 minutes',
    'Je peux passer mardi matin — pièces incluses pour joint + siphon.',
    'pending'
  );

  RAISE NOTICE 'Demo ready. pro=% client=% bookings=% % % % % %',
    v_pro_id, v_client_uid, v_b1, v_b2, v_b3, v_b4, v_b5, v_b6;
END $$;

-- Verify
SELECT b.public_booking_code, b.status, b.cancel_policy_snapshot, b.cancel_fee_type_snapshot, b.cancel_fee_cents_snapshot,
       (SELECT count(*) FROM public.booking_claim_requests c WHERE c.booking_id = b.id) AS claims,
       (SELECT count(*) FROM public.payments p WHERE p.booking_id = b.id) AS payments
FROM public.bookings b
WHERE b.public_booking_code LIKE 'DEMO-%'
ORDER BY b.public_booking_code;

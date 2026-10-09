-- Patch DEMO completed bookings to full Quebec invoice_snapshot v2 (GST/QST/platform fee).
-- Safe to re-run. Aligns payments.amount_cents with computed totals.

DO $$
DECLARE
  v_pro_id uuid;
  v_client_uid uuid;
BEGIN
  SELECT id INTO v_client_uid FROM auth.users WHERE lower(email) = lower('caronmellie@gmail.com') LIMIT 1;
  SELECT id INTO v_pro_id FROM public.pro_profiles WHERE user_id = (
    SELECT id FROM auth.users WHERE lower(email) = lower('johnpork23238@gmail.com') LIMIT 1
  ) LIMIT 1;

  IF v_pro_id IS NULL OR v_client_uid IS NULL THEN
    RAISE EXCEPTION 'Demo pro/client not found';
  END IF;

  -- DEMO-SAT-DONE-5 — base 9500 → total 11445
  UPDATE public.bookings b SET
    invoice_number = coalesce(b.invoice_number, 910001),
    invoice_snapshot = jsonb_build_object(
      'v', 2,
      'paid_at', (b.preferred_date::timestamp + interval '12 hours')::timestamptz,
      'pro_profile_id', v_pro_id::text,
      'business_name', 'Pork Plomberie Pro (Demo)',
      'service_name', 'Plomberie express',
      'duration_label', '90 min',
      'appointment_summary', to_char(b.preferred_date, 'YYYY-MM-DD') || ' · 10:00',
      'preferred_date', b.preferred_date::text,
      'preferred_time', b.preferred_time,
      'service_duration_minutes', 90,
      'service_category_slug', 'home-improvement',
      'service_slug', 'plumbing-services',
      'currency', 'CAD',
      'base_amount_cents', 9500,
      'subtotal', 95,
      'gst', 4.75,
      'qst', 9.9500625,
      'processing_fee', 4.75,
      'total_cents', 11445,
      'square_payment_id', 'demo_sq_sat1',
      'idempotency_key', 'demo-sat-done-5',
      'client_renews_annually', true,
      'renewal_interval_months', 12,
      'renewal_anchor_date', b.preferred_date::text,
      'booking_public_code', 'DEMO-SAT-DONE-5',
      'invoice_number', coalesce(b.invoice_number, 910001),
      'supplier_legal_name', 'Pork Plomberie Inc.',
      'supplier_address', '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
      'supplier_gst_number', '123456789RT0001',
      'supplier_qst_number', '1234567890TQ0001',
      'service_description_detailed', 'Plomberie express — 90 min — Fuite / réparation rapide',
      'customer_address', '450 Av. Greene, Westmount, QC H3Z 2K4',
      'payment_method_label', 'Visa •••• 4242'
    )
  WHERE b.pro_profile_id = v_pro_id AND b.client_id = v_client_uid AND b.public_booking_code = 'DEMO-SAT-DONE-5';

  UPDATE public.payments p SET amount_cents = 11445
  FROM public.bookings b
  WHERE p.booking_id = b.id AND b.public_booking_code = 'DEMO-SAT-DONE-5' AND b.pro_profile_id = v_pro_id;

  -- DEMO-SAT-DONE-OK — base 12000 → total 14457
  UPDATE public.bookings b SET
    invoice_number = coalesce(b.invoice_number, 910002),
    invoice_snapshot = jsonb_build_object(
      'v', 2,
      'paid_at', (b.preferred_date::timestamp + interval '12 hours')::timestamptz,
      'pro_profile_id', v_pro_id::text,
      'business_name', 'Pork Plomberie Pro (Demo)',
      'service_name', 'Débouchage',
      'duration_label', '90 min',
      'appointment_summary', to_char(b.preferred_date, 'YYYY-MM-DD') || ' · 14:00',
      'preferred_date', b.preferred_date::text,
      'preferred_time', b.preferred_time,
      'service_duration_minutes', 90,
      'service_category_slug', 'home-improvement',
      'service_slug', 'drain-cleaning',
      'currency', 'CAD',
      'base_amount_cents', 12000,
      'subtotal', 120,
      'gst', 6,
      'qst', 12.5685,
      'processing_fee', 6,
      'total_cents', 14457,
      'square_payment_id', 'demo_sq_sat2',
      'idempotency_key', 'demo-sat-done-ok',
      'booking_public_code', 'DEMO-SAT-DONE-OK',
      'invoice_number', coalesce(b.invoice_number, 910002),
      'supplier_legal_name', 'Pork Plomberie Inc.',
      'supplier_address', '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
      'supplier_gst_number', '123456789RT0001',
      'supplier_qst_number', '1234567890TQ0001',
      'service_description_detailed', 'Débouchage — 90 min — Drain / canalisation',
      'customer_address', '450 Av. Greene, Westmount, QC H3Z 2K4',
      'payment_method_label', 'Mastercard •••• 4444'
    )
  WHERE b.pro_profile_id = v_pro_id AND b.client_id = v_client_uid AND b.public_booking_code = 'DEMO-SAT-DONE-OK';

  UPDATE public.payments p SET amount_cents = 14457
  FROM public.bookings b
  WHERE p.booking_id = b.id AND b.public_booking_code = 'DEMO-SAT-DONE-OK' AND b.pro_profile_id = v_pro_id;

  -- DEMO-DIS-MILD — base 20000 → total 24095
  UPDATE public.bookings b SET
    invoice_number = coalesce(b.invoice_number, 910004),
    invoice_snapshot = jsonb_build_object(
      'v', 2,
      'paid_at', (b.preferred_date::timestamp + interval '12 hours')::timestamptz,
      'pro_profile_id', v_pro_id::text,
      'business_name', 'Pork Plomberie Pro (Demo)',
      'service_name', 'Plomberie salle de bain',
      'duration_label', '120 min',
      'appointment_summary', to_char(b.preferred_date, 'YYYY-MM-DD') || ' · 11:00',
      'preferred_date', b.preferred_date::text,
      'preferred_time', b.preferred_time,
      'service_duration_minutes', 120,
      'service_category_slug', 'home-improvement',
      'service_slug', 'bathroom-remodel',
      'currency', 'CAD',
      'base_amount_cents', 20000,
      'subtotal', 200,
      'gst', 10,
      'qst', 20.9475,
      'processing_fee', 10,
      'total_cents', 24095,
      'square_payment_id', 'demo_sq_dis1',
      'idempotency_key', 'demo-dis-mild',
      'booking_public_code', 'DEMO-DIS-MILD',
      'invoice_number', coalesce(b.invoice_number, 910004),
      'supplier_legal_name', 'Pork Plomberie Inc.',
      'supplier_address', '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
      'supplier_gst_number', '123456789RT0001',
      'supplier_qst_number', '1234567890TQ0001',
      'service_description_detailed', 'Plomberie salle de bain — 120 min — Robinet / joint',
      'customer_address', '450 Av. Greene, Westmount, QC H3Z 2K4',
      'payment_method_label', 'Visa •••• 1111'
    )
  WHERE b.pro_profile_id = v_pro_id AND b.client_id = v_client_uid AND b.public_booking_code = 'DEMO-DIS-MILD';

  UPDATE public.payments p SET amount_cents = 24095
  FROM public.bookings b
  WHERE p.booking_id = b.id AND b.public_booking_code = 'DEMO-DIS-MILD' AND b.pro_profile_id = v_pro_id;

  -- DEMO-DIS-REFUND — base 17500 → total 21083
  UPDATE public.bookings b SET
    invoice_number = coalesce(b.invoice_number, 910005),
    invoice_snapshot = jsonb_build_object(
      'v', 2,
      'paid_at', (b.preferred_date::timestamp + interval '12 hours')::timestamptz,
      'pro_profile_id', v_pro_id::text,
      'business_name', 'Pork Plomberie Pro (Demo)',
      'service_name', 'Chauffe-eau',
      'duration_label', '180 min',
      'appointment_summary', to_char(b.preferred_date, 'YYYY-MM-DD') || ' · 13:00',
      'preferred_date', b.preferred_date::text,
      'preferred_time', b.preferred_time,
      'service_duration_minutes', 180,
      'service_category_slug', 'home-improvement',
      'service_slug', 'water-heater-services',
      'currency', 'CAD',
      'base_amount_cents', 17500,
      'subtotal', 175,
      'gst', 8.75,
      'qst', 18.3290625,
      'processing_fee', 8.75,
      'total_cents', 21083,
      'square_payment_id', 'demo_sq_dis2',
      'idempotency_key', 'demo-dis-refund',
      'booking_public_code', 'DEMO-DIS-REFUND',
      'invoice_number', coalesce(b.invoice_number, 910005),
      'supplier_legal_name', 'Pork Plomberie Inc.',
      'supplier_address', '123 Rue Saint-Jacques, Montréal, QC H2Y 1L6',
      'supplier_gst_number', '123456789RT0001',
      'supplier_qst_number', '1234567890TQ0001',
      'service_description_detailed', 'Chauffe-eau — 180 min — Installation / service',
      'customer_address', '450 Av. Greene, Westmount, QC H3Z 2K4',
      'payment_method_label', 'Visa •••• 2222'
    )
  WHERE b.pro_profile_id = v_pro_id AND b.client_id = v_client_uid AND b.public_booking_code = 'DEMO-DIS-REFUND';

  UPDATE public.payments p SET amount_cents = 21083
  FROM public.bookings b
  WHERE p.booking_id = b.id AND b.public_booking_code = 'DEMO-DIS-REFUND' AND b.pro_profile_id = v_pro_id;
END $$;

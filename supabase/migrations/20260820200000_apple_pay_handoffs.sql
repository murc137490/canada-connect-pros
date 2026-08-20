-- Apple Pay QR handoff (Windows/Android → iPhone Safari)
CREATE TABLE IF NOT EXISTS public.apple_pay_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  draft jsonb NOT NULL,
  square_payment_id text,
  idempotency_key text,
  payment_method_label text,
  booking_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS apple_pay_handoffs_client_id_idx
  ON public.apple_pay_handoffs (client_id);

CREATE INDEX IF NOT EXISTS apple_pay_handoffs_status_expires_idx
  ON public.apple_pay_handoffs (status, expires_at);

ALTER TABLE public.apple_pay_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apple_pay_handoffs_select_own ON public.apple_pay_handoffs;
CREATE POLICY apple_pay_handoffs_select_own
  ON public.apple_pay_handoffs FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS apple_pay_handoffs_insert_own ON public.apple_pay_handoffs;
CREATE POLICY apple_pay_handoffs_insert_own
  ON public.apple_pay_handoffs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS apple_pay_handoffs_update_own ON public.apple_pay_handoffs;
CREATE POLICY apple_pay_handoffs_update_own
  ON public.apple_pay_handoffs FOR UPDATE TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

GRANT SELECT, INSERT, UPDATE ON public.apple_pay_handoffs TO authenticated;

-- Payments log for Square: store payment attempts and Square payment IDs for reconciliation.
-- The Edge Function square-create-payment calls Square API; you can optionally log here.

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'CAD',
  square_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_pro_profile_id ON public.payments(pro_profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments(idempotency_key);

COMMENT ON TABLE public.payments IS 'Log of Square payments; idempotency_key prevents duplicate charges.';

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Pros can read payments for their profile
CREATE POLICY "Pros can read own payments"
  ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

-- Clients can read payments for their bookings (optional)
CREATE POLICY "Clients can read payments for their bookings"
  ON public.payments FOR SELECT
  USING (
    booking_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND client_id = auth.uid())
  );

-- Inserts/updates are done only by the Edge Function using the service_role key (RLS is bypassed).
-- No INSERT/UPDATE/DELETE policy for authenticated = only backend can write.

# Square Payments – SQL, Edge Function, .env & Square Setup

Use this as a single reference for Square integration: SQL to run, Edge Function (already in repo), environment variables, Square Developer setup, and what’s left to do on the frontend.

---

## 1. SQL (run in Supabase SQL Editor or via migration)

Run this **once** in the Supabase SQL Editor (or apply the migration `supabase/migrations/20260304100000_payments_square.sql`).

```sql
-- Payments log for Square: store payment attempts and Square payment IDs for reconciliation.
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

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pros can read own payments"
  ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

CREATE POLICY "Clients can read payments for their bookings"
  ON public.payments FOR SELECT
  USING (
    booking_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND client_id = auth.uid())
  );
```

---

## 2. Edge Function (already in repo)

The function **`square-create-payment`** is at:

`supabase/functions/square-create-payment/index.ts`

It:

- Accepts `POST` body: `source_id`, `amount_cents`, `pro_profile_id`, optional `booking_id`, `currency`, `idempotency_key`.
- Calls Square `POST /v2/payments` with that amount and the token.
- Optionally logs a row into `public.payments` when `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set in the function’s environment.

**Request body (from your frontend):**

```json
{
  "source_id": "cnon:...",
  "amount_cents": 5000,
  "currency": "CAD",
  "pro_profile_id": "uuid-of-pro-profile",
  "booking_id": "uuid-of-booking",
  "idempotency_key": "unique-key-per-attempt"
}
```

**Deploy the function:**

```bash
supabase functions deploy square-create-payment
```

---

## 3. Environment variables

### Frontend `.env` (already have some of these)

```env
# Supabase (existing)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Square – used by the Web Payments SDK in the browser (no secrets here)
VITE_SQUARE_APPLICATION_ID=sq0idp-xxxxx
VITE_SQUARE_LOCATION_ID=Lxxxxx
```

- `VITE_SQUARE_APPLICATION_ID`: from Square Developer Dashboard → Application → Credentials (Application ID).
- `VITE_SQUARE_LOCATION_ID`: from Square Developer Dashboard → Locations (or Sandbox locations for testing). Used by the Web SDK for context; the Edge Function can override with its own `SQUARE_LOCATION_ID` if needed.

### Supabase Edge Function secrets (required for `square-create-payment`)

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets, or via CLI:

```bash
supabase secrets set SQUARE_ACCESS_TOKEN=EAAA...
supabase secrets set SQUARE_LOCATION_ID=Lxxxxx
```

Optional:

```bash
# Use production Square API (default is sandbox if not set)
supabase secrets set SQUARE_ENVIRONMENT=production
```

**Required:**

| Variable                 | Description |
|--------------------------|-------------|
| `SQUARE_ACCESS_TOKEN`    | Square **Access Token** (Sandbox or Production). From Square Developer → Credentials. |
| `SQUARE_LOCATION_ID`     | Square **Location ID** where payments are taken. From Square Dashboard → Locations. |

**Optional (for logging to `payments` table):**

| Variable                      | Description |
|-------------------------------|-------------|
| `SUPABASE_URL`                | Usually auto-set by Supabase for Edge Functions. |
| `SUPABASE_SERVICE_ROLE_KEY`   | Service role key so the function can insert into `payments`. |

**Optional (for production):**

| Variable             | Description |
|----------------------|-------------|
| `SQUARE_ENVIRONMENT` | Set to `production` to use live Square; omit or leave unset for sandbox. |

---

## 4. What you need from Square

1. **Square Developer account**  
   - Sign up: https://developer.squareup.com  
   - Create an **Application** (e.g. “Canada Connect Pros”).

2. **Credentials**  
   - In the app: **Credentials**.
   - **Sandbox**: copy **Access Token** and (optionally) **Location ID** (Sandbox → Locations).
   - **Production**: use **Production** credentials when going live (and set `SQUARE_ENVIRONMENT=production`).

3. **Web Payments SDK**  
   - Same app → **Web Payments SDK**.
   - You need the **Application ID** (and optionally Location ID) for the script that loads the SDK in the browser. These are the same as in your `.env`: `VITE_SQUARE_APPLICATION_ID` and `VITE_SQUARE_LOCATION_ID`.

4. **Permissions**  
   - For **Create payment**, the token must have **PAYMENTS_WRITE** (default for standard access tokens). If you use **application fees**, you may need **PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS** and a separate application fee setup.

5. **Locations**  
   - Square Dashboard → **Locations**.
   - Copy the **Location ID** for the location that should receive the money (sandbox location for testing, production location for live).

---

## 5. Other things to do

1. **Run the SQL**  
   - Apply the `payments` table (and policies) above in the Supabase SQL Editor, or run the migration.

2. **Set Edge Function secrets**  
   - `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and optionally `SQUARE_ENVIRONMENT`, `SUPABASE_SERVICE_ROLE_KEY` (if you want DB logging).

3. **Deploy the Edge Function**  
   - `supabase functions deploy square-create-payment`.

4. **Frontend: Square Web Payments SDK**  
   - On the page where the customer pays (e.g. after choosing a pro’s service and fixed amount):
     - Load the Square Web Payments SDK script (use your `VITE_SQUARE_APPLICATION_ID` and, if needed, `VITE_SQUARE_LOCATION_ID`).
     - Render the **Card** (or other payment method) form in a modal/popup.
     - On “Pay”, call the SDK to tokenize the card and get a **payment token** (nonce).
     - Call your Edge Function with:
       - `source_id`: that token
       - `amount_cents`: the pro’s fixed price in cents
       - `pro_profile_id`: the pro’s profile id
       - `booking_id`: if you created a booking row
       - `idempotency_key`: e.g. `bookingId + '-' + Date.now()` or a UUID stored for this attempt (same key = no double charge).
   - Docs: https://developer.squareup.com/docs/web-payments/overview

5. **Use the fixed amount from your DB**  
   - When the pro sets a fixed price (e.g. in “My Services”), store it (e.g. in cents). When the client books that service, use that amount as `amount_cents` in the payment request.

6. **After a successful payment**  
   - Update the booking (e.g. `status = 'paid'` or add a `payment_id` column and store `data.payment_id` from the Edge Function response). Optionally show a receipt or redirect to a confirmation page.

---

## 6. Quick reference

| Item              | Where |
|-------------------|--------|
| SQL               | Above in §1, or `supabase/migrations/20260304100000_payments_square.sql` |
| Edge Function     | `supabase/functions/square-create-payment/index.ts` |
| Frontend .env     | `VITE_SQUARE_APPLICATION_ID`, `VITE_SQUARE_LOCATION_ID` (and Supabase vars) |
| Edge Function env | `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`; optional: `SQUARE_ENVIRONMENT`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` |
| Square            | Developer app → Credentials (token, app id) + Locations (location id); Web Payments SDK for frontend |

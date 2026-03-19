# Stripe Setup (Booking Payments)

## 1. Keys

- **Publishable key** (`pk_test_...` or `pk_live_...`): safe to use in the browser. Put it in your **`.env`** as:
  ```env
  VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
  ```
- **Secret key** (`sk_test_...` or `sk_live_...`): must **never** be in the frontend or in the repo. Use it only on the server.

## 2. Supabase Edge Function (server)

The `create-payment-intent` Edge Function creates a Stripe PaymentIntent using your **secret key**.

1. Deploy the function (if not already):
   ```bash
   supabase functions deploy create-payment-intent
   ```
2. In **Supabase Dashboard** → **Edge Functions** → **create-payment-intent** → **Secrets**, add:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** your Stripe secret key (e.g. `sk_test_...`)

The function is called by the frontend to get a `client_secret`; the frontend then uses Stripe.js (with the publishable key) to confirm the payment.

## 3. Frontend (.env)

In your project root `.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

Restart the dev server after changing `.env`.

## 4. Production

- Use **live** keys (`pk_live_...`, `sk_live_...`) in production.
- Set `VITE_STRIPE_PUBLISHABLE_KEY` in your hosting env (e.g. Vercel).
- Set `STRIPE_SECRET_KEY` in Supabase Edge Function secrets for the production project.

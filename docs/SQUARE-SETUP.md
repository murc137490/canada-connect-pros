# Square Payment Setup (Premiere Services)

Use **Square** for booking payments. Configure the following.

---

## 1. Where to find your Square credentials

### Application ID (frontend – safe to expose)

- **Square Developer Dashboard:** [developer.squareup.com](https://developer.squareup.com) → **Applications** → your app → **Credentials**.
- **Sandbox:** use the **Sandbox** tab. You’ll see **Application ID** (e.g. `sandbox-sq0idb-...`). This is your **Application ID** for the Web Payments SDK.
- **Production:** use the **Production** tab and copy the **Application ID** there.

### Access token (backend only – never expose)

- Same **Credentials** page: **Access token** (Sandbox or Production).
- **Sandbox:** short token for testing.
- **Production:** use the production access token for live payments.
- This must **only** be set in **Supabase Edge Function secrets** (see below), never in `.env` or frontend.

### Location ID

- **Square Developer Dashboard** → **Locations** (or **Square Dashboard** → **Locations**).
- Copy the **Location ID** (e.g. `L...`) for the location that will receive the payments.
- Sandbox has a default sandbox location; use its ID for testing.

---

## 2. Frontend (.env)

Add to your `.env` (or `.env.local`):

```env
# Square Web Payments (booking checkout)
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-8aRXGjs1vZ34fNhtrDHiEQ
VITE_SQUARE_LOCATION_ID=your_location_id_here
```

- **Sandbox:** use the sandbox Application ID (as in the example) and your **sandbox** Location ID.
- **Production:** replace with your **production** Application ID and **production** Location ID.

---

## 3. Backend (Supabase Edge Function secrets)

The `square-create-payment` Edge Function must have these secrets set in the Supabase Dashboard:

1. **Supabase Dashboard** → your project → **Edge Functions** → **square-create-payment** → **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**).
2. Add:

| Secret name           | Value                                      | Notes                                      |
|-----------------------|--------------------------------------------|--------------------------------------------|
| `SQUARE_ACCESS_TOKEN` | Your Square **Access token** (sandbox or prod) | Required. Never put this in the frontend.  |
| `SQUARE_LOCATION_ID`  | Your Square **Location ID**                | Optional; can also use frontend location.  |
| `SQUARE_ENVIRONMENT`  | `sandbox` or `production`                  | Optional; default is sandbox if not set.   |

- **Sandbox:** use your **sandbox** access token; leave `SQUARE_ENVIRONMENT` unset or set to `sandbox`.
- **Production:** use your **production** access token and set `SQUARE_ENVIRONMENT` to `production`.

---

## 4. Deploy the Edge Function

From the project root:

```bash
supabase functions deploy square-create-payment
```

Then set the secrets in the Dashboard as above.

---

## 5. Summary

| Where to use it | What to set | Where to find it |
|-----------------|------------|-------------------|
| **.env** (frontend) | `VITE_SQUARE_APPLICATION_ID` | Developer Dashboard → Applications → your app → Credentials → Application ID (Sandbox/Production) |
| **.env** (frontend) | `VITE_SQUARE_LOCATION_ID` | Developer Dashboard → Locations (or Square Dashboard → Locations) |
| **Supabase secrets** | `SQUARE_ACCESS_TOKEN` | Developer Dashboard → Applications → your app → Credentials → Access token |
| **Supabase secrets** (optional) | `SQUARE_LOCATION_ID` | Same as frontend Location ID |
| **Supabase secrets** (optional) | `SQUARE_ENVIRONMENT` | `sandbox` or `production` |

After this, the booking payment step will use Square; users can pay by card (and any other methods you enable in the Square application).

---

## 6. Square Connect (OAuth) — per‑pro payouts

Verified pros can **Connect Square** in **Dashboard → Pro**. That stores OAuth tokens in `pro_square_tokens` (no client access) and the seller **`square_location_id`** on `pro_profiles` for the Web Payments SDK.

1. **Square Developer Dashboard → OAuth**  
   - Add **Redirect URL**: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/square-oauth-callback`  
     (Example project URL pattern — replace with your real Supabase project host from **Settings → API**.)  
   - After success, users are sent to **`https://www.premiereservices.ca/dashboard?tab=pro`** when `SITE_URL`/`PUBLIC_SITE_URL` is set to `https://www.premiereservices.ca` (or your `VITE_SITE_URL` in production).  
   - Use the **same Application ID** as `VITE_SQUARE_APPLICATION_ID` (your Connect / Web Payments app).

2. **Supabase Edge Function secrets** (set on **square-oauth-start**, **square-oauth-callback**, **square-create-payment**, and **square-oauth-disconnect** — or use project-wide secrets):

| Secret | Notes |
|--------|--------|
| `SQUARE_OAUTH_APPLICATION_ID` | Same as production/sandbox Application ID (OAuth client id). |
| `SQUARE_OAUTH_APPLICATION_SECRET` | From Developer Dashboard → OAuth. |
| `SQUARE_OAUTH_STATE_SECRET` | Long random string; signs the OAuth `state` parameter (CSRF + pro binding). |
| `SITE_URL` or `PUBLIC_SITE_URL` | Production example: **`https://www.premiereservices.ca`** — where users return after OAuth (`/dashboard?tab=pro`). |

3. **square-create-payment** also needs **`SQUARE_OAUTH_APPLICATION_SECRET`** (and the same `SQUARE_OAUTH_APPLICATION_ID` if not using a single project secret) so it can **refresh** seller access tokens when they expire.

4. **Booking payments**  
   - If the pro has connected Square, the charge uses the **seller’s** access token and **`app_fee_money`** = **2.1% of the service subtotal** (your platform share). The customer receipt still shows **one ~5% “card & platform” line** on the service amount (~2.9% card processing + 2.1% platform — **not** 2.9% + an extra 5%).  
   - Optional secret **`PLATFORM_APP_FEE_RATE`**: decimal override (e.g. `0.021`) on **`square-create-payment`**; default is **0.021**.
   - If not connected, the app keeps using **`SQUARE_ACCESS_TOKEN`** + **`VITE_SQUARE_LOCATION_ID`** (legacy single-merchant mode).

Deploy:

```bash
supabase functions deploy square-oauth-start square-oauth-callback square-oauth-disconnect square-create-payment
```

Apply the migration that adds `pro_square_tokens` and `pro_profiles.square_location_id`.

---

## 7. Payment amount and tax

- **Amount:** The app sends the **total amount in cents** to Square (based on the pro’s minimum price or a fixed minimum). Square does **not** calculate tax; the amount is exactly what you pass. If you want tax included, add it to the amount before calling the API (e.g. subtotal + tax = total).
- **Tax:** Currently the UI shows “Amount (before tax)”. To support tax, you can compute it in the app and add it to the total before creating the payment.

---

## 8. Sandbox test cards

In **sandbox**, use these test card numbers so the form accepts the number and processes a test payment:

| Card brand   | Number               | Expiry   | CVV  |
|-------------|----------------------|----------|------|
| Visa        | 4111 1111 1111 1111  | Any future (e.g. 12/34) | 111  |
| Mastercard  | 5105 1051 0510 5100  | Any future             | 111  |

If you see “Enter a valid card number”, make sure you’re using one of these (and that `VITE_SQUARE_APPLICATION_ID` is the **sandbox** Application ID).

---

## 9. What’s already implemented vs. generic “marketplace” advice

**Already in this repo (no need to add Next.js `/api/pay` or raw `window.Square.payments` unless you prefer it):**

- **Frontend:** `src/components/SquareBookingPayment.tsx` uses **`react-square-web-payments-sdk`**, which wraps Square’s **`@square/web-sdk`** (`payments(applicationId, locationId)` → card / Google Pay, tokenize, etc.). Same Web Payments flow as the official “card container + token” pattern.
- **Backend:** `supabase/functions/square-create-payment` calls Square **`POST /v2/payments`** with `source_id` (the nonce from the SDK), `amount_money` in **cents**, `autocomplete: true`, and upserts a row into the **`payments`** table (when `SUPABASE_SERVICE_ROLE_KEY` is set).
- **CDN:** `index.html` includes `https://web.squarecdn.com/v1/square.js` with `defer` so the script can load early; the React SDK still initializes payments as usual.

**Corrections to common third‑party checklists:**

| Topic | Accurate for this project |
|--------|---------------------------|
| **Location ID** | It is always a Square **Location ID** string (often starts with `L` in APIs). It is **not** the literal word `"main"` — use the ID shown next to your sandbox or production location in the Developer Dashboard / Locations. |
| **Environment** | Controlled by Supabase secret **`SQUARE_ENVIRONMENT`**: unset or not `production` → sandbox API host; **`production`** → `https://connect.squareup.com`. Must match the **same** mode as your **Application ID** and **Access token**. |
| **Secrets in `.env`** | **Never** put **`SQUARE_ACCESS_TOKEN`** in the frontend `.env`. Only **`VITE_SQUARE_APPLICATION_ID`** and **`VITE_SQUARE_LOCATION_ID`** belong there. |
| **OAuth / “Connect Square”** | **Implemented** for verified pros: OAuth redirect to Supabase **`square-oauth-callback`**, tokens in **`pro_square_tokens`**, seller location on **`pro_profiles.square_location_id`**, and **`app_fee_money`** on **`square-create-payment`** when the pro is connected. Legacy single-merchant mode remains if a pro has not connected. |
| **Webhooks** | Optional for reliability; the Edge Function already uses **`autocomplete: true`** and returns payment status. You can add Square webhooks later to reconcile `bookings` / `payments`. |

**Going live (production) checklist:**

1. Square Developer Console: switch to **Production** and copy **Production Application ID** → `VITE_SQUARE_APPLICATION_ID`.
2. Copy **Production** location ID → `VITE_SQUARE_LOCATION_ID`.
3. Copy **Production** access token → Supabase secret **`SQUARE_ACCESS_TOKEN`**.
4. Set Supabase secret **`SQUARE_ENVIRONMENT`** to **`production`** (exact string).
5. Deploy **`square-create-payment`** after changing secrets.
6. Site must use **HTTPS** in production (Square blocks the Web SDK on insecure origins except localhost).

### Apple Pay — domain verification file

If Square asks to **add domain** and host `/.well-known/apple-developer-merchantid-domain-association`, follow **`docs/SQUARE-APPLE-PAY-DOMAIN.md`**: download the file from Square, save it under `public/.well-known/` in this repo, deploy, then verify in Square.

**SCA / 3DS:** The app does not pass `createVerificationDetails` to Square’s `verifyBuyer` (a full payload requires billing contact and other fields; an incomplete object caused runtime errors). Card payments still work; Square may prompt verification when required.

---

## Complete secrets checklist (Supabase + Square)

**Injected automatically on Edge Functions (do not paste manually unless self-hosting):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Frontend `.env` (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SQUARE_APPLICATION_ID`, `VITE_SQUARE_LOCATION_ID`, optional `VITE_SITE_URL`, and **`VITE_GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_PLACES_API_KEY`** (needed to resolve postal codes on **All Services** and elsewhere).

**Supabase → Edge Functions → Secrets (project-wide recommended):**

| Secret | Used by | Required? |
|--------|---------|-----------|
| `SQUARE_ACCESS_TOKEN` | `square-create-payment` | Yes for legacy / platform-only charges |
| `SQUARE_LOCATION_ID` | `square-create-payment` | Optional (can match frontend location) |
| `SQUARE_ENVIRONMENT` | `square-create-payment`, OAuth functions | Optional (`production` for live) |
| `SQUARE_OAUTH_APPLICATION_ID` | `square-oauth-start`, `square-oauth-callback`, token refresh in `square-create-payment` | Yes if pros use **Connect Square** |
| `SQUARE_OAUTH_APPLICATION_SECRET` | `square-oauth-callback`, `square-create-payment` (refresh) | Yes if OAuth enabled |
| `SQUARE_OAUTH_STATE_SECRET` | `square-oauth-start`, `square-oauth-callback` | Yes if OAuth enabled (long random string) |
| `SITE_URL` or `PUBLIC_SITE_URL` | `square-oauth-callback`, emails | Strongly recommended (e.g. `https://www.premiereservices.ca`) |
| `PLATFORM_APP_FEE_RATE` | `square-create-payment` | Optional (default `0.021` = 2.1% application fee) |

Deploy: `square-create-payment`, `square-oauth-start`, `square-oauth-callback`, `square-oauth-disconnect` after setting secrets.

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

## 6. Payment amount and tax

- **Amount:** The app sends the **total amount in cents** to Square (based on the pro’s minimum price or a fixed minimum). Square does **not** calculate tax; the amount is exactly what you pass. If you want tax included, add it to the amount before calling the API (e.g. subtotal + tax = total).
- **Tax:** Currently the UI shows “Amount (before tax)”. To support tax, you can compute it in the app and add it to the total before creating the payment.

---

## 7. Sandbox test cards

In **sandbox**, use these test card numbers so the form accepts the number and processes a test payment:

| Card brand   | Number               | Expiry   | CVV  |
|-------------|----------------------|----------|------|
| Visa        | 4111 1111 1111 1111  | Any future (e.g. 12/34) | 111  |
| Mastercard  | 5105 1051 0510 5100  | Any future             | 111  |

If you see “Enter a valid card number”, make sure you’re using one of these (and that `VITE_SQUARE_APPLICATION_ID` is the **sandbox** Application ID).

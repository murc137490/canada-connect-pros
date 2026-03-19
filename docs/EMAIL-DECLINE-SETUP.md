# Email for declined applications and bookings

When an admin **declines a pro application** or a **pro declines a client booking**, the app can send an email with the reason. This uses [Resend](https://resend.com) (or you can swap for another provider in the Edge Functions).

---

## 1. Run SQL (required for Admin decline)

Run once in **Supabase → SQL Editor**:

```sql
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS application_declined_at timestamptz;
```

This lets declined pro applicants disappear from the Admin list and stores that they were declined.

---

## 2. Admin: Accept and remove pros (no Edge Functions needed)

Run once in **Supabase → SQL Editor** so the admin can accept pending applications and remove pros from the Dashboard:

**File:** `supabase/ADMIN-ACCEPT-REMOVE-RPC.sql` (paste its contents and run).

This creates RPCs `accept_pro_by_admin` and `remove_pro_by_admin`. Only the user with email `premiereservicescontact@gmail.com` can call them. After running, use **Dashboard → Admin** to accept or remove pros.

---

## 3. Deploy Edge Functions

Deploy the email-related and admin functions (from project root):

```bash
supabase functions deploy decline-pro
supabase functions deploy send-booking-declined-email
supabase functions deploy admin-remove-pro
```

**admin-remove-pro:** Lets the admin (premiereservicescontact@gmail.com) remove a pro from the "All professionals" list. That user becomes a normal account (no pro profile). No secrets required.

---

## 4. Resend (optional – to actually send email)

1. Sign up at [resend.com](https://resend.com) and get an **API key**.
2. **Supabase Dashboard** → your project → **Edge Functions** → **Secrets** (or Project Settings → Edge Functions → Secrets).
3. Add:

| Secret | Value | Used by |
|--------|--------|--------|
| `RESEND_API_KEY` | Your Resend API key | `decline-pro`, `send-booking-declined-email` |
| `DECLINE_PRO_FROM_EMAIL` | (optional) Sender for pro decline, e.g. `notifications@yourdomain.com` | `decline-pro` |
| `BOOKING_DECLINED_FROM_EMAIL` | (optional) Sender for booking declined, e.g. `notifications@yourdomain.com` | `send-booking-declined-email` |

If `RESEND_API_KEY` is not set, the functions still run (DB updates, etc.) but no email is sent.

---

## 5. What each function does

- **decline-pro**  
  Called when admin clicks **Decline** on a pro application. Sets `application_declined_at` on that pro profile and sends the applicant an email with the optional reason.

- **send-booking-declined-email**  
  Called when a pro declines a booking (after the booking is updated to `status: 'declined'`). Sends the client an email with the decline reason and booking details. Only the pro who owns the booking can trigger this.

---

## 6. Network error when paying

If you see **"Network error when attempting to fetch resource"** on the payment step:

1. **VITE_SUPABASE_URL** in `.env` must be your project URL (e.g. `https://xxxx.supabase.co`) with no trailing slash.
2. Deploy the **square-create-payment** Edge Function and set its secrets (see `docs/SQUARE-SETUP.md`).
3. In the browser, check the Network tab: the request should go to `https://xxxx.supabase.co/functions/v1/square-create-payment`. If the URL is wrong or the function is not deployed, you get a network error.

# Resend app email pipeline

This function sends application emails through Resend using the embedded English/French templates in:

`supabase/functions/send-app-email/index.ts`

It is for booking/support/admin emails. Keep Supabase Auth emails such as confirm signup, reset password, and magic link in **Supabase Dashboard -> Authentication -> Emails -> Templates** unless you later wire a Supabase Send Email Hook.

## 1. Resend setup

1. In Resend, verify the domain `premiereservices.ca`.
2. Add the DNS records Resend gives you.
3. Create an API key.

## 2. Supabase secrets

Set these secrets:

```bash
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set FROM_EMAIL="support@premiereservices.ca"
supabase secrets set FROM_NAME="Premiere Services"
supabase secrets set REPLY_TO_EMAIL="support@premiereservices.ca"
supabase secrets set SITE_URL="https://premiereservices.ca"
supabase secrets set EMAIL_PIPELINE_SECRET="generate-a-long-random-secret"
supabase secrets set ADMIN_NOTIFICATION_EMAIL="premiereservicescontact@gmail.com"
supabase secrets set DEFAULT_TIMEZONE="America/Toronto"
```

Optional:

```bash
supabase secrets set SUPPORT_HOURS_EN="Mon-Fri, 8am-8pm EST"
supabase secrets set SUPPORT_HOURS_FR="Lun.-ven., 8 h-20 h HNE"
```

## 3. Deploy

```bash
supabase functions deploy send-app-email
```

`supabase/config.toml` sets `verify_jwt = false` for this function because it performs its own authorization:

- Normal app calls can use the logged-in user's `Authorization: Bearer <access_token>`.
- Database webhooks, cron jobs, or server automations can use `x-email-pipeline-secret`.

## 4. Supported email types

```text
booking_created
booking_confirmed
booking_cancelled
booking_reminder
support_receipt
admin_new_booking
auth_confirm_signup
auth_reset_password
auth_magic_link
```

The first six are the normal app-domain emails.

The three `auth_*` types are only for a future custom Supabase Send Email Hook or a server-side custom auth flow. Do not use them to replace Supabase's built-in Auth templates until that hook is intentionally wired.

## 5. English vs French (how language is chosen)

This function does **not** use one Resend template with `{{if french}}`. It has **two full templates per type** (`en` and `fr`) in code. The API picks one set based on `language`.

### Automatic (recommended)

| Email group | Default language source |
|-------------|-------------------------|
| `booking_*` (client) | `profiles.email_language` for the **client** on that booking (`en` or `fr` from signup / Dashboard account settings) |
| `support_receipt` | `profiles.email_language` if you pass `recipient_user_id`; else `en` |
| `auth_*` | `profiles.email_language` if `recipient_user_id`; else `en` |
| `admin_new_booking` | Secret `ADMIN_EMAIL_LANGUAGE` or `en` |

Your app already saves `email_language` at signup (`AuthContext`) and in Dashboard account settings.

### Force a language on any call

Pass either field (same meaning):

```json
{
  "type": "booking_confirmed",
  "booking_id": "uuid",
  "language": "fr"
}
```

or:

```json
{
  "email_language": "fr"
}
```

If `language` / `email_language` is **`en` or `fr`**, it **overrides** the profile. If omitted, profile/default applies.

The JSON response includes `"language": "en"` or `"fr"` so you can confirm which template was used.

### Supabase Auth emails (separate system)

**Confirm signup, reset password, magic link** should stay in **Supabase Dashboard → Authentication → Emails**. Those use Go templates like `{{ .ConfirmationURL }}`, not this function—unless you later add a Send Email Hook that calls `auth_*` types here.

| System | Templates live in | Language switch |
|--------|-------------------|-----------------|
| **send-app-email** | Edge Function code (`copy` object) | `"language": "fr"` or client `profiles.email_language` |
| **Supabase Auth** | Dashboard email templates | Separate EN/FR templates in dashboard, or one template per language |

## 6. Example calls

Booking confirmed, called by a logged-in user who owns the booking or the pro account:

```ts
await supabase.functions.invoke("send-app-email", {
  body: {
    type: "booking_confirmed",
    booking_id: bookingId,
    variables: {
      service_type: "Plumbing repair"
    }
  }
});
```

24-hour reminder, called from a server/cron job:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-app-email" \
  -H "Content-Type: application/json" \
  -H "x-email-pipeline-secret: $EMAIL_PIPELINE_SECRET" \
  -d '{
    "type": "booking_reminder",
    "booking_id": "BOOKING_UUID",
    "variables": {
      "reminder_window": "in 24 hours",
      "service_type": "Home cleaning"
    }
  }'
```

French support receipt:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-app-email" \
  -H "Content-Type: application/json" \
  -H "x-email-pipeline-secret: $EMAIL_PIPELINE_SECRET" \
  -d '{
    "type": "support_receipt",
    "to_email": "client@example.com",
    "name": "Jean Dupont",
    "language": "fr",
    "subject": "Question sur ma réservation",
    "message": "Bonjour, j’ai besoin d’aide."
  }'
```

Admin internal notification:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-app-email" \
  -H "Content-Type: application/json" \
  -H "x-email-pipeline-secret: $EMAIL_PIPELINE_SECRET" \
  -d '{
    "type": "admin_new_booking",
    "booking_id": "BOOKING_UUID",
    "variables": {
      "service_type": "Appliance repair"
    }
  }'
```

## 7. Template variables (`{{name}}` in subjects and HTML)

Use **double curly braces** in the Edge Function templates (same idea as Supabase’s `{{ .ConfirmationURL }}`, but different names).

### All types — common footer variables

| Variable | Auto-filled | Notes |
|----------|-------------|--------|
| `{{support_hours}}` | Yes | EN/FR from secrets |
| `{{terms_url}}` | Yes | `SITE_URL/terms` |
| `{{privacy_url}}` | Yes | `SITE_URL/privacy` |
| `{{cancellation_policy_url}}` | Yes | Usually terms URL |
| `{{reschedule_policy_url}}` | Yes | Usually terms URL |

### Booking emails (`booking_created`, `booking_confirmed`, `booking_cancelled`, `booking_reminder`)

| Variable | Auto-filled | You can pass in `variables` |
|----------|-------------|----------------------------|
| `{{name}}` | Client display name | Override |
| `{{client_name}}` | Same as name | Override |
| `{{client_email}}` | From auth | — |
| `{{client_phone}}` | From profile | — |
| `{{pro_name}}` | Business name | — |
| `{{booking_id}}` | UUID | — |
| `{{booking_date}}` | Formatted from booking | Override |
| `{{booking_time}}` | Formatted from booking | Override |
| `{{timezone}}` | `DEFAULT_TIMEZONE` secret | Override |
| `{{booking_location}}` | Pro location | Override |
| `{{service_type}}` | **You should pass** | Required for a clear email |
| `{{amount_paid}}` | Latest payment | Override |
| `{{payment_status}}` | Latest payment | Override |
| `{{booking_status}}` | Booking row | — |
| `{{cancellation_reason}}` | Decline reason | `booking_cancelled` |
| `{{reminder_window}}` | — | `booking_reminder` e.g. `"in 24 hours"` / `"dans 24 heures"` |
| `{{manage_booking_url}}` | Dashboard link | Override |

### `admin_new_booking`

Same booking fields as above, plus:

| Variable | Notes |
|----------|--------|
| `{{admin_booking_url}}` | Admin tab link (auto) |

Set language with `"language": "fr"` or secret `ADMIN_EMAIL_LANGUAGE=fr`.

### `support_receipt`

| Variable | Pass in body or `variables` |
|----------|----------------------------|
| `{{name}}` | `name` |
| `{{email}}` | Recipient email |
| `{{ticket_id}}` | `ticket_id` (or auto UUID) |
| `{{subject}}` | `subject` |
| `{{message}}` | `message` |
| `{{submitted_date}}` | Optional |

### Auth types (`auth_confirm_signup`, `auth_reset_password`, `auth_magic_link`)

Pipeline secret required. Map Supabase hook fields like this:

| Supabase Auth | send-app-email `variables` |
|---------------|----------------------------|
| `{{ .ConfirmationURL }}` | `confirmation_url` → `{{confirmation_url}}` |
| `{{ .ConfirmationURL }}` (reset) | `reset_url` → `{{reset_url}}` |
| Magic link URL | `magic_link_url` → `{{magic_link_url}}` |
| `{{ .Email }}` | `email` / recipient lookup |
| `{{ .SiteURL }}` | Already in `SITE_URL` for footer links |

Also pass `"language": "fr"` or rely on `recipient_user_id` + `profiles.email_language`.

### Example — French booking confirmed

```json
{
  "type": "booking_confirmed",
  "booking_id": "BOOKING_UUID",
  "language": "fr",
  "variables": {
    "service_type": "Réparation de plomberie"
  }
}
```

### Example — English with profile default (omit language)

```json
{
  "type": "booking_created",
  "booking_id": "BOOKING_UUID",
  "variables": {
    "service_type": "Home cleaning"
  }
}
```

Uses client `profiles.email_language` from signup/Dashboard.

## 8. Supabase Auth templates

Keep these inside Supabase:

- Confirm sign up
- Invite user
- Magic link
- Change email address
- Reset password
- Reauthentication
- Password changed
- Email/phone/security notifications

Use Supabase's variables there, especially:

```html
{{ .ConfirmationURL }}
{{ .Email }}
{{ .Token }}
{{ .TokenHash }}
{{ .SiteURL }}
{{ .RedirectTo }}
```

Set the sender in **Authentication -> Emails -> SMTP Settings**:

```text
Sender name: Premiere Services
Sender email: support@premiereservices.ca
Host: smtp.resend.com
Port: 465 or 587
Username: resend
Password: your Resend API key
```

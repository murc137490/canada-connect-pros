# AltShift go-live checklist

Brand: **AltShift** · Legal entity: **Services AltShift Inc.** · Domain: **altshift.ca**

This file lists everything outside the React app that must be updated before public launch.
The website code is already rebranded in-repo.

## Before the public flip

### 1) Domain & hosting (Vercel / Cloudflare DNS)

1. Point `altshift.ca` and `www.altshift.ca` DNS to Vercel (or your host).
2. In Vercel → Project → Domains: add `altshift.ca` and `www.altshift.ca`.
3. Set production env:
   - `VITE_SITE_URL=https://www.altshift.ca`
   - `VITE_SUPABASE_URL=…`
   - `VITE_SUPABASE_ANON_KEY=…`
   - Square / Maps keys as already used
4. Keep `premiereservices.ca` DNS temporarily if you still own it; redirects to `www.altshift.ca` are in `vercel.json`.
5. After SSL is green on `www.altshift.ca`, deploy `main`.

**Cloudflare prompt (if DNS is on Cloudflare):**
> Add A/CNAME records for altshift.ca and www.altshift.ca to my Vercel project. Proxy can stay DNS-only or proxied; ensure SSL Full (strict). Do not break existing premiereservices.ca until 301 redirects to www.altshift.ca are confirmed.

### 2) Supabase Auth URLs

Dashboard → Authentication → URL Configuration:

- Site URL: `https://www.altshift.ca`
- Redirect URLs include:
  - `https://www.altshift.ca/**`
  - `https://www.altshift.ca/auth/callback`
  - `http://localhost:3000/**` (dev)
  - keep old premierservices URLs briefly if needed during cutover

**Supabase prompt:**
> Update Auth Site URL to https://www.altshift.ca and allow redirects for https://www.altshift.ca/** and https://www.altshift.ca/auth/callback. Keep localhost for development. Brand is now AltShift (Services AltShift Inc.).

### 3) Supabase Edge Function secrets

Update secrets (Settings → Edge Functions → Secrets), then **redeploy** all email/payment/oauth functions:

| Secret | Suggested value |
|--------|-----------------|
| `SITE_URL` / `PUBLIC_SITE_URL` | `https://www.altshift.ca` |
| `FROM_EMAIL` | `support@altshift.ca` or `no-reply@altshift.ca` |
| `FROM_NAME` | `AltShift` |
| `REPLY_TO_EMAIL` | `support@altshift.ca` |
| `RESEND_API_KEY` | (new or same provider key) |
| Square / Twilio / HF keys | unchanged unless rotating |

Redeploy at minimum: `send-app-email`, `account-deletion`, `referral-invite`, `ai-chat-hf`, `geocode`, `square-oauth-callback`, `square-create-payment`, `square-finalize-payment`, `square-register-apple-pay-domain`, `decline-pro`, `admin-remove-pro`, `booking-sms-notify`, claim/declined email functions.

**Supabase CLI prompt:**
> Redeploy all Supabase Edge Functions after SITE_URL/FROM_EMAIL/FROM_NAME were changed to AltShift / https://www.altshift.ca / support@altshift.ca.

### 4) Resend (email)

1. Add and verify domain **altshift.ca** (SPF, DKIM, DMARC DNS records Resend shows).
2. Sending domain / from addresses: `support@altshift.ca`, `no-reply@altshift.ca`, `notifications@altshift.ca`.
3. Update Auth email templates in Supabase (confirm signup, magic link, reset password) using files in `supabase/email-templates/` (already say AltShift).
4. Remove or leave old premiereservices.ca domain until traffic dies.

**Resend prompt:**
> Verify domain altshift.ca for transactional email. Create SPF/DKIM/DMARC records. Allow sending from support@altshift.ca, no-reply@altshift.ca, and notifications@altshift.ca for AltShift (Services AltShift Inc.).

### 5) Square

1. Update business/public name to **AltShift** / **Services AltShift Inc.** where Square shows the statement descriptor (within Square’s character limits).
2. Square App → Redirect URL for OAuth: `https://<project>.supabase.co/functions/v1/square-oauth-callback` (unchanged) but success return uses `SITE_URL` → must be altshift.ca.
3. Register Apple Pay domain: `www.altshift.ca` (and apex if needed) via `square-register-apple-pay-domain`.
4. Upload Apple domain association file under `public/.well-known/` if required for the new domain.
5. Update customer-facing location / receipt branding if Square Dashboard has a public business name field.

**Square prompt:**
> Our consumer brand is now AltShift (legal: Services AltShift Inc.), live site https://www.altshift.ca. Update statement descriptors, OAuth return site URL, and register Apple Pay for www.altshift.ca.

### 6) Google (Maps / OAuth / Gemini if used)

1. Google Cloud Console → Credentials: add authorized JS origins / redirect URIs for `https://www.altshift.ca` (and remove or keep old domain during transition).
2. Maps / Places API key HTTP referrer restrictions: add `https://www.altshift.ca/*`.
3. If Gemini/Google AI is used for any feature: update any project display name; API keys usually don’t need rename.
4. OAuth consent screen: app name **AltShift**, support email `support@altshift.ca`, authorized domains `altshift.ca`.

**Google Cloud prompt:**
> Rebrand app to AltShift. Add https://www.altshift.ca to OAuth authorized origins/redirects and to Maps API key HTTP referrer allowlist. Support email support@altshift.ca. Legal entity Services AltShift Inc.

### 7) Hugging Face / support AI

No rename required for the model. Redeploy `ai-chat-hf` so prompts/links point at altshift.ca (already in code). Confirm `HF_TOKEN` / model secrets still set.

### 8) Twilio

1. Update friendly name / messaging brand to AltShift if shown to users.
2. Verify caller ID / messaging service still works.
3. Ensure `booking-sms-notify` copy (redeployed) says AltShift.

### 9) Mailboxes

Create/migrate:

- `support@altshift.ca` (public)
- `no-reply@altshift.ca` (Resend)
- `notifications@altshift.ca` (optional)
- Privacy contact mailbox if different

Forward old `*@premiereservices.ca` → new addresses for 6–12 months.

### 10) Legal / corporate

1. Confirm corporate registration **Services AltShift Inc.** matches `LEGAL_ENTITY_NAME` in code.
2. Have counsel re-issue Terms / Privacy / Cookies with the new name + domain (drafts still say REVIEW_REQUIRED in places).
3. Update invoices, contracts, and any PDF letterheads.
4. Update Québec / Canada tax accounts (GST/QST) display name if required.

### 11) Analytics / pixels (if any)

Update domain filters, property URLs, and cookie policy links to altshift.ca.

### 12) Demo accounts

Code now expects `@altshift.demo` demo emails. If showcase users still use `@premierservices.demo`, either recreate them or keep dual detection (currently detects `@altshift.demo` and demo.* patterns).

### 13) Staff admin allowlist

Code allowlist placeholders are `admin1@altshift.ca` … `admin5@altshift.ca`. Ensure real staff emails are set via `profiles.is_platform_admin` / `manage-platform-admins` — don’t rely on unused placeholders.

## Smoke test before announcing

- [ ] https://www.altshift.ca loads, title/favicon say AltShift
- [ ] Signup confirmation email arrives from altshift.ca domain
- [ ] Password reset + magic link work
- [ ] Google OAuth (if enabled) returns to altshift.ca
- [ ] Pro Square Connect returns to dashboard on altshift.ca
- [ ] Booking authorize/capture still works
- [ ] Apple Pay domain association on www.altshift.ca
- [ ] Support AI links point to altshift.ca
- [ ] Account deletion email links use altshift.ca
- [ ] Old premierservices.ca → 301 to altshift.ca

## Already done in this repo

- UI, meta tags, boot splash, invoices, terms/privacy/cookie brand strings
- Email shared layout + Auth HTML templates
- Edge function default SITE_URL / FROM_* / brand copy
- Vercel apex + legacy domain redirects
- Demo domain `@altshift.demo`

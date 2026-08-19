# LEGAL FACT-FINDING REPORT — Première Services

**Document type:** Factual inventory for Quebec business/technology counsel  
**Scope:** Application codebase at project root (`canada-connect-pros` / Première Services) and accessible Supabase project schema/configuration  
**Date of inspection:** 2026-08-13  
**Method:** Read-only inspection of source code, routes, i18n/copy, Edge Function source in repo, and Supabase MCP `list_tables` / `execute_sql` / `list_edge_functions`  

**Hard constraints observed for this report:**  
- No application code, schema, data, auth settings, or production resources were modified for this task.  
- No legal conclusions (compliance / non-compliance) are stated.  
- Status labels: **CONFIRMED FROM CODE**, **PARTIALLY CONFIRMED**, **NOT FOUND**, **UNKNOWN**.  
- Secrets/API keys/tokens are never reproduced. Where credential material is stored in schema, noted as: `SECRET/KEY FOUND — VALUE REDACTED`.

---

## 1. Executive Summary

Première Services appears, from the codebase, to be a **Canadian home-services marketplace web application** (React/Vite frontend, Supabase backend, Vercel-oriented hosting patterns). Customers browse services by category, enter a postal code, optionally post job requests, receive quotes from professionals, book appointments on pro profiles, and can pay via **Square**. Professionals create profiles, await admin verification (`is_verified`), subscribe to paid plans (Starter / Growth / Pro), optionally connect Square OAuth, respond to bookings/job requests, and leave/receive reviews.

Observed revenue mechanisms in code include **pro subscription payments to the platform Square account**, a **~2.1% Square `app_fee_money`** when charging on a connected seller, and a **legacy path that charges the platform Square merchant** when the pro has no Connect tokens. Marketing and Terms also describe platform fees (~5% display line) and commissions; automated refunds via Square/Stripe APIs were **not found**.

Legal documents found: **Terms of Service + Professional Service Provider Agreement** at `/terms` (EN/FR content). A **Privacy Policy route `/privacy` is linked in places but no matching route/page was found in `App.tsx`**. Cookie consent is UI/`localStorage` only. Terms acceptance for pros is UI gating; **no DB column recording terms acceptance was found**.

Third parties evidenced in code: Supabase, Square, Google (Maps/Places/OAuth/geocode), Hugging Face (support/search AI), Resend (email functions), Twilio (SMS/verify functions), geocoder.ca / Zippopotam (geocode fallbacks). Analytics SDKs (GA/gtag/etc.) were **not found** in `src`.

---

## 2. Business Model

| Topic | Finding | Status |
|-------|---------|--------|
| What Première Services is | Marketplace connecting clients with home-service professionals (browse, request, quote, book, pay, review). Branding: “Première Services”. | CONFIRMED FROM CODE |
| Customers | Authenticated users booking/browsing; no separate `role` enum — any `auth.users` user can act as client. | CONFIRMED FROM CODE |
| Service providers | Users with a `pro_profiles` row; public listing requires `is_verified = true`. | CONFIRMED FROM CODE |
| How customers find/request services | `/services` → category → pros list; hero/search; `/make-request` → `job_requests`. Postal gating for browse. | CONFIRMED FROM CODE |
| How providers respond | Accept/decline bookings; send `job_quotes` on open job requests. | CONFIRMED FROM CODE |
| Providers submit quotes | Yes — `job_quotes` table + Dashboard UI. | CONFIRMED FROM CODE |
| Customers select providers | Yes — book on `/pros/:proId`; accept/decline quotes. | CONFIRMED FROM CODE |
| Customer–provider communication | No dedicated in-app DM/chat table. Support AI (`ai-chat-hf`) and booking assistant; unread flags on bookings; SMS/email possible. | PARTIALLY CONFIRMED |
| Book appointments | Yes — preferred date/time on bookings; pro schedule/availability. | CONFIRMED FROM CODE |
| Payments through Première | Square Web Payments + Edge `square-create-payment`; plan checkout on platform Square. | CONFIRMED FROM CODE |
| Providers receive payment directly | Via Square Connect (`pro_square_tokens`) + seller `square_location_id`; else platform merchant charges. | CONFIRMED FROM CODE |
| Charges customers | Yes for bookings (service + displayed card/platform fee line; taxes in invoice snapshot). | CONFIRMED FROM CODE |
| Charges providers | Subscription checkout (`pro-plan-checkout`); plan amounts in code defaults (e.g. 2000/2700/3200 CAD cents). | CONFIRMED FROM CODE |
| Subscriptions | `pro_subscriptions`, tiers `starter` / `growth` / `pro`; trials via `trial-checkout` / tokens. | CONFIRMED FROM CODE |
| Commissions / platform fee | Square Connect `app_fee_money` ~2.1% of service subtotal; UI/invoice often shows ~5% “card & platform” line. Terms mention commissions/fees. | CONFIRMED FROM CODE (rates dual-described) |
| Lead fees | Plan copy refers to lead limits by tier; separate per-lead charge not found as a payment API. | PARTIALLY CONFIRMED |
| Other revenue | Referral invites; trial tokens; return discount flags on cancel. | PARTIALLY CONFIRMED |
| Platform takes possession of customer funds | Terms say platform may collect/hold; code: Connect → seller + app fee, or legacy → platform Square; `autocomplete: true` (immediate capture). No escrow release workflow found. | PARTIALLY CONFIRMED |
| Refunds by Première | Terms: case-by-case, not guaranteed. Admin can set claim `admin_resolution = 'refunded'`. No Square/Stripe Refund API call found. | PARTIALLY CONFIRMED |
| Disputes by Première | `booking_claim_requests` + admin issue reports; emails via claim functions. Mediation language in Terms. | CONFIRMED FROM CODE (workflow) / PARTIALLY (outcomes) |

---

## 3. User Types

### 3.1 Customer / client (authenticated user without requiring pro profile)

| Item | Finding | Status |
|------|---------|--------|
| Registration | `/auth?mode=signup` — full name, email, phone, password, email language EN/FR; optional `?ref=` referral | CONFIRMED FROM CODE |
| Auth methods | Email/password; Google OAuth; login can resolve name→email via RPC `get_email_for_name` | CONFIRMED FROM CODE |
| Email verification | Supabase email confirmation flow (`email_confirmed_at`) used for some features | CONFIRMED FROM CODE |
| Phone verification | Phone collected; `twilio-verify` Edge exists; **no frontend caller found** | PARTIALLY CONFIRMED |
| Password requirements | Signup UI `minLength={6}`; reset password UI `minLength={8}` + strength meter; Auth project policy UNKNOWN | PARTIALLY CONFIRMED |
| Profile fields | `profiles`: full_name, avatar, phone, birthday, address, postal_code, email_language, booking ID photo path, public_user_number, job_request strikes/block | CONFIRMED FROM CODE |
| Account deletion | Self-serve delete **not found** (sign-out only) | NOT FOUND |
| Suspension | Terms allow; dedicated suspension flag/workflow **not found** | NOT FOUND |
| Privileges | Create bookings/job requests; pay; review pros; save favorites; submit claims; use support AI when logged in | CONFIRMED FROM CODE |

### 3.2 Professional (pro)

| Item | Finding | Status |
|------|---------|--------|
| Becoming a pro | Auth → `/join-pros` → profile editor → plan/onboarding; starts `is_verified=false` until admin accept | CONFIRMED FROM CODE |
| Privileges | Manage profile/services/photos; accept bookings; quote jobs; subscriptions; Square connect; review clients; (tier-gated SMS/AI features) | CONFIRMED FROM CODE |
| Removal | Admin Edge remove-pro deletes `pro_profiles` | CONFIRMED FROM CODE |

### 3.3 Platform admin / moderator

| Item | Finding | Status |
|------|---------|--------|
| Identification | Email allowlist synced via `ensure-platform-admin` / `PLATFORM_ADMIN_EMAILS`; `profiles.is_platform_admin` | CONFIRMED FROM CODE |
| Privileges | Accept/decline/remove pros; job request moderation; issue reports; trial tokens; Whats New; read payments/subscriptions (RLS) | CONFIRMED FROM CODE |

---

## 4. Customer Flow

1. Land on `/` — postal + need search (hero); marketing chapters.  
2. Browse `/services` (postal often required) → `/services/:slug` → `/services/:cat/:svc/pros`.  
3. Optional `/make-request` → `job_requests` (+ photos in `job-request-photos`).  
4. Pros send `job_quotes`; client accepts/declines in Dashboard.  
5. Or book on `/pros/:proId` (date/time/service; ID verification photo; terms scroll).  
6. Pay via Square (when checkout invoked).  
7. Dashboard: bookings, quotes, reviews, invoices (`invoice_snapshot`), favorites, account.  
8. Support: `/support` or HelpFab → `ai-chat-hf` (requires session).

**Status:** CONFIRMED FROM CODE  

---

## 5. Provider Flow

1. `/join-pros` (marketing; auth redirect).  
2. `/create-pro-account` / profile editor: business info, services, area, photos, ID/selfie, optional insurance/cert text.  
3. Plan selection `/pro-plans` / onboarding; Square checkout for tier; optional Growth trial.  
4. Admin reviews pending pros → Edge `accept-pro` sets `is_verified=true` (or decline).  
5. Dashboard pro tools: bookings, nearby jobs, schedule, reviews, Square connect, featured page options (tier-dependent).  

**Status:** CONFIRMED FROM CODE  

---

## 6. Payments

| Mechanism | What code does | Status |
|-----------|----------------|--------|
| Square booking charge | `square-create-payment` — token → Square Payments API; Connect seller + `app_fee_money` OR platform merchant | CONFIRMED FROM CODE |
| Square OAuth | `square-oauth-start` / `square-oauth-callback`; tokens in `pro_square_tokens` | CONFIRMED FROM CODE — SECRET/KEY FOUND — VALUE REDACTED |
| Pro plan checkout | `pro-plan-checkout` charges platform Square; updates `pro_subscriptions` | CONFIRMED FROM CODE |
| Trial checkout | `trial-checkout` stores Square customer/card refs for trial | CONFIRMED FROM CODE |
| Stripe | `create-payment-intent` + `StripeBookingPayment.tsx` exist; **not wired** into current booking UI | PARTIALLY CONFIRMED (orphan) |
| PayPal | — | NOT FOUND |
| Payment webhooks | — | NOT FOUND |
| Automated refunds | — | NOT FOUND |
| Invoices/receipts | `bookings.invoice_snapshot` JSON + Dashboard invoices UI; Quebec-style GST/QST fields in snapshots | CONFIRMED FROM CODE |
| Fee messaging | UI ~5% “card & platform”; Connect app fee ~2.1% in Edge comments/code | CONFIRMED FROM CODE |

---

## 7. Personal Information

| Category | Collected where | Storage | Who can access (from RLS/UI) | Third parties |
|----------|-----------------|---------|------------------------------|---------------|
| Name | Auth signup; profiles | `profiles.full_name`; auth metadata | RLS: “Anyone can view profiles” (SELECT) | Google OAuth if used; emails |
| Email | Auth | `auth.users` (not public table) | User + admin tooling | Resend, Square customer, Google |
| Phone | Signup; pro profile | `profiles.phone`, `pro_profiles.phone` | Profiles SELECT broad; used for SMS | Twilio (if configured) |
| Address / postal / city | Profile; job requests; browse localStorage/cookie | `profiles`, `job_requests`, cookie `premiere_browse_postal` | Job requests: own + pros for open + moderators | Geocode APIs |
| GPS lat/lng | Geocode of postal; pro location | `job_requests`, `pro_profiles` | As above | Google / geocoder.ca / Zippopotam |
| Account IDs | System | UUIDs across tables; `public_user_number` | Parties to records; some public | — |
| Profile / work photos | Uploads | Storage `pro-photos`, `pro-public`; `pro_photos` | Public buckets/URLs for many | Supabase Storage CDN |
| ID / personal selfie (pro) | Pro application | `personal_photo_url`, `id_document_url` | Admin review UI; not intended public | Supabase Storage |
| Client booking ID photo | Booking flow | `profiles.booking_id_verification_photo_path`; bucket `client-booking-verification` (private) | Terms: may show to assigned pro | Supabase Storage |
| Business info | Pro editor | `pro_profiles` (legal name, GST/QST numbers, address, etc.) | “Anyone can view pro profiles” SELECT | — |
| Service requests | Make request | `job_requests` (+ public photo bucket) | Client, matching pros, moderators | AI category field optional |
| Quotes / messages on quotes | Quote form | `job_quotes.message` | Client of job + quoting pro | — |
| Reviews | Dashboard / pro page | `reviews`, `client_reviews`, photos | Broad SELECT (“Anyone can view…”) | — |
| Uploaded claim evidence | Claims | `booking-evidence` (public bucket) | Admin + parties via UI | Email attachments paths |
| Payment metadata | Checkout | `payments` (amount, status, card brand/last4, square_payment_id) | Client/pro of booking + platform admin SELECT | Square |
| Appointment info | Bookings | `bookings` preferred_date/time, status, etc. | RLS policy name: **“Anyone can view bookings”** | Email/SMS |
| Auth credentials | Auth | Supabase Auth | User | Google if OAuth |
| Cookies / local prefs | Browser | Cookie consent + browse postal | Device | — |
| AI chat content | Support / booking assistant | Sent to Edge → HF; persistence of full chat in DB **not confirmed** (HelpFab uses localStorage history) | User device; HF API | Hugging Face |
| IP / device / analytics | — | — | — | NOT FOUND for product analytics SDKs; hosting/CDN may log (UNKNOWN) |

---

## 8. Supabase Database

### 8.1 Tables observed (`list_tables`, public schema)

`profiles`, `pro_profiles`, `pro_services`, `pro_photos`, `pro_licenses`, `reviews`, `review_photos`, `review_responses`, `bookings`, `client_reviews`, `job_requests`, `job_quotes`, `pro_profile_views`, `payments`, `admin_actions`, `services` (**RLS disabled**), `booking_claim_requests`, `plans`, `subscriptions`, `subscription_plans`, `pro_subscriptions`, `client_saved_pros`, `trial_tokens`, `trial_grants`, `trial_attempts`, `referral_invites`, `service_bundles`, `service_bundle_items`, `pro_square_tokens`, `service_browse_stats`, `pro_plan_cancellations`, `review_submission_locks`, `client_review_submission_locks`, `platform_admin_config`, `platform_whats_new_announcements`, `job_request_moderation_notices`.

Row counts at inspection time are environment-specific (e.g. `pro_profiles` reported 0 rows; `job_requests`/`job_quotes` reported 2).

### 8.2 Important relationships (conceptual)

- `pro_profiles.user_id` → auth user  
- `bookings` → `pro_profile_id` + `client_id`  
- `payments.booking_id` → bookings  
- `job_quotes.job_request_id` → job_requests; `pro_profile_id` → pro  
- `reviews` / `client_reviews` → pro + client (+ optional booking)  
- `pro_square_tokens.pro_profile_id` → pro (**tokens: SECRET/KEY FOUND — VALUE REDACTED**)

### 8.3 Auth

Supabase Auth (`auth.users`); app uses anon key + user JWT; Edge Functions use service role for privileged ops (pattern in comments/docs). Platform admins via email allowlist + `is_platform_admin`.

### 8.4 Storage buckets

| Bucket | Public flag |
|--------|-------------|
| `booking-evidence` | public |
| `client-booking-verification` | **private** |
| `job-request-photos` | public |
| `pro-photos` | public |
| `pro-public` | public |
| `review-photos` | public |

### 8.5 RLS

Most public tables have RLS **enabled**. Notable policies by name include broad SELECT such as **“Anyone can view bookings”**, **“Anyone can view profiles”**, **“Anyone can view pro profiles”**, **“Anyone can view reviews”**, **“Anyone can read client reviews”**.  

**`public.services` has RLS disabled** (Supabase advisor critical note at inspection).

### 8.6 Edge Functions (deployed +/or in repo)

Examples: `ai-chat-hf`, `search-suggestions`, `accept-pro`, `decline-pro` / `decline-pro-application`, `remove-pro` / `admin-remove-pro`, `square-create-payment` (`verify_jwt: false` deployed), `square-oauth-*`, `pro-plan-checkout`, `pro-plan-cancel`, `trial-checkout`, `trial-token-admin`, `geocode` (`verify_jwt: false`), `twilio-verify`, `booking-sms-notify` (in repo), `send-app-email` (in repo), `send-booking-claim-email`, `referral-invite`, `ensure-platform-admin`, `attachment_urls`, `create-payment-intent` (Stripe orphan in repo), etc.

### 8.7 Scheduled jobs

Product cron for booking reminders referenced in SMS docs/`x-booking-reminder-secret` pattern — exact production schedule **UNKNOWN** without dashboard cron inspection beyond code.

---

## 9. Third-Party Services

| Service | Purpose | Data appearing to be sent |
|---------|---------|---------------------------|
| Supabase | DB, Auth, Storage, Realtime, Edge | All app data / sessions |
| Square | Payments, OAuth Connect, cards on file for trials | Payment tokens, amounts, merchant IDs; card brand/last4 stored |
| Google | OAuth login; Maps/Places JS; Geocoding API | Auth identity; addresses/postals for geocode |
| geocoder.ca / Zippopotam | Geocode fallbacks | Postal/address strings |
| Hugging Face router | Support chat + search suggestions | Chat messages, system prompts, language |
| Resend | Transactional email (Edge) | Email addresses, booking details (when invoked) |
| Twilio | SMS notify; Verify OTP (unused by UI) | Phone numbers, SMS body |
| Vercel | Hosting (repo/deploy patterns) | Site traffic; build env | PARTIALLY CONFIRMED |
| GoDaddy | — | NOT FOUND in codebase |
| Meta / GA / Plausible | Analytics | NOT FOUND in `src` |
| Stripe | Orphan payment intent path | Would send payment data if used | PARTIALLY CONFIRMED |

---

## 10. Communications

| Channel | Integration | Trigger | Recipient | Status |
|---------|-------------|---------|-----------|--------|
| Email | Resend via `send-app-email` and specialty functions | Booking lifecycle, claims, referrals, admin remove (when called) | Client/pro/admin emails | CONFIRMED FROM CODE (config-gated) |
| SMS | Twilio `booking-sms-notify` | After booking confirm; reminders with secret | Client phone | CONFIRMED FROM CODE (Pro tier + config) |
| Push | — | — | — | NOT FOUND |
| In-app | Booking unread + Realtime | Booking updates | Client/pro dashboards | CONFIRMED FROM CODE |
| Support AI | HF | User messages (logged-in) | HF API | CONFIRMED FROM CODE |
| Phone (human) | Marketing/support copy | — | — | PARTIALLY CONFIRMED (copy only) |

---

## 11. Reviews / User Content

| Content | Can create? | Visibility | Admin remove |
|---------|-------------|------------|--------------|
| Client→pro reviews (+ photos) | Yes | Public on pro page (RLS Anyone SELECT) | Dedicated review moderation UI **NOT FOUND** |
| Pro→client reviews (+ photos) | Yes | Client dashboard; RLS Anyone SELECT on `client_reviews` | NOT FOUND |
| Pro responses to reviews | Yes | Public | NOT FOUND |
| Job request photos/text | Yes | Pros matching + moderators | Moderators can remove/moderate job requests |
| Pro portfolio photos | Yes | Public | Via remove-pro / pro delete |
| Service request descriptions | Yes | Matching pros | Yes (moderation) |
| In-app client↔pro chat | — | — | NOT FOUND |

Blind dual-review reveal logic exists in app (`reviewBlind.ts`).

---

## 12. Provider Verification

| Requirement / claim | Implementation | Status |
|---------------------|----------------|--------|
| Business name, bio, services, area, prices | Profile editor → `pro_profiles` / `pro_services` | CONFIRMED FROM CODE |
| Personal photo + ID document | Required in UI; stored for admin | CONFIRMED FROM CODE |
| Insurance Yes/No | Form field | PARTIALLY CONFIRMED — **not written** into `pro_profiles` payload on save (per code review) |
| Certifications text | Form | PARTIALLY CONFIRMED — persistence incomplete |
| Licenses table `pro_licenses` | Schema + display | PARTIALLY CONFIRMED — create flow does not insert licenses |
| Admin `is_verified` flag | Edge `accept-pro` | CONFIRMED FROM CODE — **admin decision, not automated license API** |
| Background checks | Marketing: “Background checked” | PARTIALLY CONFIRMED (copy only); integration **NOT FOUND** |
| Identity checks / license verification claims | FAQ marketing | PARTIALLY CONFIRMED (copy); Terms say verification is limited |

---

## 13. Cancellations / Refunds / Disputes

| Topic | Software behavior | Status |
|-------|-------------------|--------|
| Booking decline | Pro declines with reason; email function exists | CONFIRMED FROM CODE |
| Plan cancel | `pro-plan-cancel` Edge; `pro_plan_cancellations` analytics | CONFIRMED FROM CODE |
| Customer cancel booking workflow | Terms language; specific automated refund cancel path | PARTIALLY CONFIRMED / UNKNOWN |
| Claims / complaints | `booking_claim_requests`; Admin Issue Reports; emails | CONFIRMED FROM CODE |
| Refund execution | Admin resolution label `refunded`; no processor refund API found | PARTIALLY CONFIRMED |
| Chargebacks | — | NOT FOUND in app code |
| Job request strikes / block | `job_request_strikes`, `job_requests_blocked_at` on profiles | CONFIRMED FROM CODE |
| Remove provider | Admin remove-pro | CONFIRMED FROM CODE |
| Account suspension | Terms; code flag | NOT FOUND |

---

## 14. Liability-Relevant Features

| Feature / claim | Source | Notes |
|-----------------|--------|-------|
| Booking Guarantee (rebooking, quality, replacement pro) | `BookingGuarantee.tsx`, i18n `t.guarantee.*`, pro page badges | Marketing UI |
| “Verified” badge | `is_verified` + UI | Admin-gated listing |
| “Background checked” | Demo/phone marketing strings | No check integration found |
| “Payment Protection System” | Plans marketing copy | |
| Satisfaction guarantee FAQ | `faq4a` | |
| FAQ: verification includes identity & license checks | `faq3a` | |
| Terms: platform is intermediary; no warranties; verification limited; does not guarantee licensing/background | `termsContent.ts` | Contrasts with some marketing |
| Terms: payments may be collected/held; off-platform payment restrictions | `termsContent.ts` | |
| Client ID upload for booking verification | Booking + Terms § on ID | May be shown to assigned pro |

**No legal conclusion** is drawn about whether these create obligations.

---

## 15. Privacy / Data Flows

```
USER BROWSER
  → Vite/React app (likely Vercel host)
  → Supabase Auth / PostgREST / Storage / Realtime
  → Edge Functions
       → Square / Google / HF / Resend / Twilio / geocoder.ca
```

Additional local: `localStorage` (locale, cookie consent, browse postal, support chat history), cookie `premiere_browse_postal`.

---

## 16. Existing Legal Documents

| Document | Exists? | Location | Must accept? | Acceptance recorded? |
|----------|---------|----------|--------------|----------------------|
| Terms of Service | Yes | `/terms`, `src/content/termsContent.ts`, `TermsOfService.tsx` | Pro onboarding scroll+checkbox; booking scroll-to-enable | **NOT FOUND** in DB |
| Professional Service Provider Agreement | Yes | Same terms page / content | Pro checkbox | **NOT FOUND** in DB |
| Privacy Policy | Linked (`/privacy`) | **No route in `App.tsx`** | — | NOT FOUND |
| Cookie notice | Banner | `CookieConsent.tsx` | Preferences/login gating | `localStorage` only |
| Refund / cancellation policy | Sections in Terms | No standalone pages | — | — |
| Community guidelines | — | NOT FOUND as separate doc | — | — |

Auth signup: **no** terms/privacy checkboxes found on `Auth.tsx`.

---

## 17. Language / Localization

| Item | Finding | Status |
|------|---------|--------|
| EN + FR UI | `LanguageContext` + `translations.ts` | CONFIRMED FROM CODE |
| Default locale | Stored preference; initial fallback **`fr`** if unset | CONFIRMED FROM CODE |
| Language selector | Header EN/FR toggle | CONFIRMED FROM CODE |
| Legal EN + FR | `termsContent.ts` bilingual sections | CONFIRMED FROM CODE |
| Support AI language | Inferred EN/FR; system prompt forces reply language | CONFIRMED FROM CODE |
| UGC language | User-controlled | CONFIRMED FROM CODE |

---

## 18. Administration

| Capability | Present? | Role |
|------------|----------|------|
| Accept / decline / remove pros | Yes | Platform admin |
| Moderate job requests | Yes (`AdminJobRequests`) | Moderators/admin |
| Issue / claim reports | Yes (`AdminIssueReports`) | Admin |
| Trial tokens | Yes | Admin |
| Whats New announcements | Yes | Admin |
| View payments | RLS SELECT for platform admin | Admin |
| Issue processor refunds | Label only | PARTIALLY |
| Edit any pro profile | RLS update policies for admin/moderators | Yes |
| Suspend/delete user auth account | — | NOT FOUND |
| Moderate reviews | — | NOT FOUND |
| Export PI tooling | — | NOT FOUND |

---

## 19. Security Controls

| Control | Observation | Status |
|---------|-------------|--------|
| Supabase Auth | Email/password, Google OAuth, JWT to API | CONFIRMED FROM CODE |
| RLS | Enabled on most tables; some policies very broad SELECT | CONFIRMED FROM CODE |
| `services` RLS | **Disabled** | CONFIRMED FROM CODE |
| Admin authorization | Email allowlist + `is_platform_admin` | CONFIRMED FROM CODE |
| Edge JWT | Most `verify_jwt: true`; `square-create-payment` and `geocode` deployed with `verify_jwt: false` | CONFIRMED FROM CODE |
| CAPTCHA | — | NOT FOUND |
| Rate limiting | HF/geocode throttles external; app-wide rate limit | PARTIALLY / UNKNOWN |
| Phone OTP | Function exists, unused by UI | PARTIALLY CONFIRMED |
| Private storage | `client-booking-verification` private; several buckets public | CONFIRMED FROM CODE |
| Secrets in DB | `pro_square_tokens` access/refresh tokens | SECRET/KEY FOUND — VALUE REDACTED |

**No penetration testing performed.**

---

## 20. Unknowns / Missing Information

- Production Supabase Auth password policy and email template config (dashboard).  
- Whether Resend/Twilio/Square/Google/HF secrets are set in production.  
- Whether production cron invokes booking SMS reminders.  
- Actual privacy policy content (page missing).  
- Hosting DNS/registrar (GoDaddy etc.) — not in repo.  
- Whether IP logs / Vercel analytics are enabled outside codebase.  
- Age gating — **NOT FOUND** in signup.  
- Data retention/deletion schedule — **NOT FOUND**.  
- Whether Terms last-updated date is finalized (`termsContent.ts` placeholder note).

---

## 21. Questions for Quebec Lawyer

Each question is tied only to facts above.

1. **Marketplace structure** — Code treats Première as intermediary (Terms) while collecting payments (Square Connect + platform merchant path). *What legal characterization fits (marketplace, agent, payment intermediary)?* Evidence: Terms intermediary language; `square-create-payment` dual path.

2. **Customer–provider contract** — Bookings/quotes created in app. *Who are the contracting parties for the service itself?* Evidence: bookings, job_quotes, Terms § independent contractors.

3. **Liability vs marketing guarantees** — UI “Booking Guarantee”, “Quality guarantee”, “Background checked” vs Terms “no warranties” / limited verification. *How should these be aligned?* Evidence: `BookingGuarantee.tsx`, FAQ, `termsContent.ts`.

4. **Terms acceptance** — Pro checkbox; booking scroll; no DB record; Auth signup without acceptance. *Is current acceptance UX adequate for Quebec?* Evidence: `TermsAcceptance`, `Auth.tsx`, absence of acceptance columns.

5. **Provider agreement** — Combined in `/terms`. *Is a separate executed PSA required?* Evidence: `TERMS_PROVIDER_AGREEMENT` content.

6. **Consumer protection (Quebec)** — Consumer bookings, fees, cancel/refund discretion. *OPC / consumer protection implications?* Evidence: booking + fee UI; Terms refund discretion.

7. **Privacy / Law 25** — Broad RLS SELECTs on profiles/bookings/reviews; missing Privacy page; public storage buckets; AI to HF. *What privacy program and notices are required?* Evidence: RLS policy names; no `/privacy` route; `ai-chat-hf`; public buckets.

8. **Consent** — Cookie banner localStorage; marketing email language preference; no cookie taxonomy beyond banner. *Consent model for cookies/AI/processing?* Evidence: `CookieConsent.tsx`.

9. **Retention / deletion** — No self-serve account deletion; ID photos; claim evidence. *Retention and deletion rights process?* Evidence: NOT FOUND deletion flow; ID/verification storage.

10. **Payments & fund handling** — Platform may collect/hold (Terms); Connect app fee; legacy platform merchant; autocomplete capture. *Money services / trust accounting / disclosure needs?* Evidence: Terms payment section; Square Edge function.

11. **Refunds** — Case-by-case Terms; admin label without processor refund. *Required refund practices for marketplace?* Evidence: Terms § refunds; AdminIssueReports.

12. **Cancellations** — Decline booking; plan cancel; incomplete customer cancel automation. *Mandatory cancellation rules?* Evidence: booking status + Terms.

13. **Reviews** — Public UGC; little moderation tooling. *Defamation / takedown process?* Evidence: reviews RLS Anyone; admin review moderation NOT FOUND.

14. **Provider licensing** — Providers must self-attest; admin verify flag; FAQ claims license checks; licenses table underused. *Platform duty regarding licensed trades in Quebec?* Evidence: FAQ, Terms, `is_verified`, `pro_licenses`.

15. **Insurance** — Asked in UI but not persisted. *Risk of implying insured pros?* Evidence: form-only insurance field.

16. **IP / UGC license** — Photos, bios, job photos uploaded. *Need explicit license grant in Terms?* Evidence: uploads to Storage; Terms IP sections (present in content file — counsel should review full text).

17. **French language** — Default `fr`; bilingual Terms; EN/FR UI. *Charter of the French Language obligations for platform?* Evidence: `LanguageContext` default `fr`; bilingual terms.

18. **GST/QST** — Invoice snapshots with gst/qst; pro GST/QST registration fields. *Platform tax collection/remittance vs pro remittance?* Evidence: `invoice_snapshot`, `gst_registration_number`, `qst_registration_number`.

19. **Advertising claims** — Guarantees, background checked, payment protection. *Advertising law risk?* Evidence: i18n guarantee/FAQ strings.

20. **Disputes** — Claim tickets + Terms require attempt via Platform first. *Enforceability / process adequacy?* Evidence: `booking_claim_requests`, Terms.

21. **Account suspension** — Promised in Terms; not implemented. *Gap risk?* Evidence: Terms vs NOT FOUND suspension code.

22. **AI support bot** — HF receives chat; support requires login; no FAQ RAG. *AI disclosure, accuracy, PI transfer outside Canada?* Evidence: `ai-chat-hf`, HF router URL.

23. **Third parties** — Square, Google, HF, Resend, Twilio. *Processor agreements / cross-border transfers?* Evidence: Edge Functions env usage.

24. **User-generated content** — Job requests moderated; reviews less so. *Notice-and-takedown?* Evidence: AdminJobRequests vs reviews.

25. **Age** — No age gate found. *Minimum age for accounts/bookings?* Evidence: NOT FOUND age check.

---

## 22. Priority Issues for Lawyer Review

1. Missing Privacy Policy page vs links to `/privacy`.  
2. Tension between guarantee/verified/background marketing and Terms disclaimers.  
3. Payment flow: Connect vs platform merchant; fund handling disclosures.  
4. Broad public SELECT RLS on bookings/profiles/reviews.  
5. Public storage of potentially sensitive evidence/job photos.  
6. Terms acceptance not recorded; signup without acceptance.  
7. No account deletion / suspension implementation.  
8. AI chat PI to Hugging Face.  
9. GST/QST and fee presentation.  
10. Provider verification claims vs actual `is_verified` process.

---

## Summary Table

| Issue | Evidence Found | Status | Lawyer Question | Priority |
|-------|----------------|--------|-----------------|----------|
| Privacy Policy missing | `/privacy` linked; no `App.tsx` route | CONFIRMED gap | Law 25 notice adequacy | HIGH |
| Marketing guarantees vs Terms | `BookingGuarantee`, FAQ vs `termsContent` disclaimers | CONFIRMED tension | Align claims / liability | HIGH |
| Payment fund handling | Square Connect + platform merchant; Terms hold language | PARTIALLY CONFIRMED | Intermediary / funds rules | HIGH |
| Broad RLS SELECT on bookings/profiles | Policy names “Anyone can view…” | CONFIRMED FROM CODE | Access control / PI exposure | HIGH |
| Public storage buckets | `job-request-photos`, `booking-evidence`, etc. public | CONFIRMED FROM CODE | Sensitive media exposure | HIGH |
| Terms acceptance not in DB | UI checkbox/scroll only | CONFIRMED FROM CODE | Formation of contract | HIGH |
| Client ID photos to pros | Booking verification + Terms | CONFIRMED FROM CODE | ID handling / Law 25 | HIGH |
| AI chat to Hugging Face | `ai-chat-hf` | CONFIRMED FROM CODE | Cross-border AI processing | HIGH |
| No account deletion | Sign-out only | NOT FOUND feature | Deletion rights process | HIGH |
| GST/QST on invoices | `invoice_snapshot`, pro tax numbers | CONFIRMED FROM CODE | Tax role of platform | HIGH |
| Verified / background claims | FAQ + marketing; no background API | PARTIALLY CONFIRMED | Misleading advertising risk | HIGH |
| Refunds not automated | Admin label; Terms discretion | PARTIALLY CONFIRMED | Refund obligations | MEDIUM |
| Insurance field not saved | Pro form | PARTIALLY CONFIRMED | Misleading “insured” implication | MEDIUM |
| License table underused | `pro_licenses` vs create flow | PARTIALLY CONFIRMED | Trade licensing duty | MEDIUM |
| Auth signup without Terms | `Auth.tsx` | CONFIRMED FROM CODE | Consent at registration | MEDIUM |
| Cookie consent local only | `CookieConsent` | CONFIRMED FROM CODE | Cookie consent validity | MEDIUM |
| `services` RLS disabled | Supabase advisor | CONFIRMED FROM CODE | Security/privacy of catalog table | MEDIUM |
| Square/geocode Edge `verify_jwt: false` | Deployed function flags | CONFIRMED FROM CODE | Abuse / auth surface | MEDIUM |
| No review moderation UI | Reviews public | NOT FOUND moderation | UGC liability process | MEDIUM |
| Suspension not implemented | Terms vs code | NOT FOUND | Enforcement of Terms | MEDIUM |
| French default + bilingual Terms | `LanguageContext`, terms FR | CONFIRMED FROM CODE | Language law obligations | MEDIUM |
| Stripe orphan code | Unused Stripe components | PARTIALLY CONFIRMED | Dead payment paths confusion | LOW |
| Analytics SDKs | — | NOT FOUND | Confirm no hidden trackers | LOW |
| Age gate | — | NOT FOUND | Minority / age rules | MEDIUM |
| GoDaddy / registrar | — | NOT FOUND in code | Hosting stack completeness | LOW |

---

## Appendix A — Key file references (non-exhaustive)

- Routes: `src/App.tsx`  
- Terms: `src/content/termsContent.ts`, `src/pages/TermsOfService.tsx`  
- Auth: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`  
- Payments: `supabase/functions/square-create-payment/index.ts`, `src/components/SquareBookingPayment.tsx`  
- Support AI: `supabase/functions/ai-chat-hf/index.ts`, `src/lib/supportChatApi.ts`  
- Guarantees copy: `src/components/BookingGuarantee.tsx`, `src/i18n/translations.ts`  
- Pro onboarding: `src/components/pro/ProProfileEditorDialog.tsx`, `src/pages/JoinPros.tsx`  

---

*End of factual report. This document is not legal advice.*

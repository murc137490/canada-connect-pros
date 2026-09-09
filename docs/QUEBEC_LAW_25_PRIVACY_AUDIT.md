# Première Services — Quebec Law 25 (P-39.1) Technical Privacy Audit Report

**Date of Audit:** September 6, 2026  
**Audited Target:** Première Services Application Codebase & Supabase Production Schema  
**Scope:** Exhaustive factual extraction from codebase files, database tables, triggers, storage policies, and Edge Functions for Quebec Law 25 compliance documentation.  

---

## 1. Legal Entity & Contacts

### Legal Entity Name, Registered Address & Business Numbers
- **Legal Entity Name:** **NOT FOUND IN CODE**.
  - `src/config/legalConfig.ts` (line 6): Explicitly marked as `LEGAL_ENTITY_NAME = "REVIEW_REQUIRED — Première Services (confirm registered legal name)"`.
  - `src/content/termsContent.ts` (line 8): `COMPANY_NAME = "Premiere Services"`.
  - `src/content/privacyContent.ts` (line 15): References `${LEGAL_ENTITY_NAME} (“Première Services”, “we”, “us”)`.
  - `src/components/Layout.tsx` (line 431): Footer renders `<span>© {new Date().getFullYear()} Première Services. {t.footer.rights}</span>`.
  - `src/lib/quebecInvoiceHtml.ts` (lines 157–158): Invoice footer text states `"Premiere Services — plateforme de mise en relation."` / `"Premiere Services — connection platform."`.
- **Registered Corporate Address:** **NOT FOUND IN CODE**.
- **Business Numbers (NEQ, Canadian Business Number, GST/QST numbers for Première Services):** **NOT FOUND IN CODE**.
  - Note: Invoice templates (`src/lib/quebecInvoiceHtml.ts`) and database tables (`pro_profiles.gst_registration_number`, `pro_profiles.qst_registration_number`) collect and display tax/business numbers for individual service professionals (suppliers), but no corporate tax or business numbers for Première Services itself exist in the codebase.

### Referenced Email Addresses & Operational Purposes
- **`support@premiereservices.ca`**:
  - Designated public customer support email (`src/config/legalConfig.ts`: `SUPPORT_EMAIL`).
  - Designated privacy contact email (`src/config/legalConfig.ts`: `PRIVACY_CONTACT.email`; `src/content/privacyContent.ts`).
  - Default transactional email sender (`FROM_EMAIL`) and reply-to (`REPLY_TO_EMAIL`) for outgoing emails (`supabase/functions/send-app-email/index.ts` lines 50, 52; `supabase/functions/_shared/premiereEmail.ts` line 28).
  - Fallback error contact displayed across UI components and translation strings (`src/main.tsx` line 14; `src/i18n/translations.ts` lines 530, 543, 655).
  - Support contact provided in AI support assistant prompts (`supabase/functions/ai-chat-hf/index.ts` lines 343, 370).
- **`murc137490@gmail.com`**:
  - Primary Super Administrator account (`SUPER_ADMIN_EMAIL` in `src/lib/platformAdminAllowlist.ts` line 3; `supabase/functions/_shared/platformAdmin.ts` line 3; `supabase/migrations/20260904010000_super_admin_staff.sql`).
  - Has unconstrained privileges to create, update, and revoke staff administrators, inspect audit logs (`platform_admin_audit_events`), manage Member IDs, and is explicitly exempt from Member ID gating (`src/components/admin/AdminMemberIdGate.tsx`; `src/pages/Auth.tsx`).
- **`admin1@premiereservices.ca` through `admin5@premiereservices.ca`**:
  - Seed allowlisted staff administrator accounts (`src/lib/platformAdminAllowlist.ts` lines 8–12; `supabase/functions/_shared/platformAdmin.ts`; `supabase/migrations/20260904010000_super_admin_staff.sql`).
  - Used by administrative staff to approve/decline professionals, moderate client job requests, manage reviews, and resolve booking claims/disputes.
- **`notifications@premiereservices.ca`**:
  - Outgoing sender address for professional decline and account removal notices (`supabase/functions/decline-pro/index.ts` line 42; `supabase/functions/admin-remove-pro/index.ts` line 17).
- **`premiereservicescontact@gmail.com`**:
  - Legacy developer/owner account referenced in earlier migrations (`supabase/migrations/20260525130000_platform_admin_moderators.sql`; `supabase/migrations/20260525140000_list_platform_admin_accounts.sql`).
- **`noreply@premiereservices.ca`**:
  - Mentioned only as a configuration option in Amazon SES documentation (`docs/SUPABASE-AMAZON-SES.md`).
- **Referenced Phone Numbers**:
  - `+1 450 910 1400`: Displayed as operational customer support phone (`src/config/legalConfig.ts`: `SUPPORT_PHONE`; `supabase/functions/ai-chat-hf/index.ts` lines 148–149, 343, 370).
  - `1-800-PREMIERE`: Non-functional placeholder in template documentation (`supabase/functions/PASTE-THIS-IN-SUPABASE.md`; `supabase/functions/ai-chat-hf/index.ts` lines 403–404).

---

## 2. Data Inventory

### Supabase / PostgreSQL Tables Storing Personal Information

| Table Name | Personal Data Columns | Creation Trigger / Source |
| :--- | :--- | :--- |
| **`public.profiles`** | `user_id` (uuid), `full_name` (text), `phone` (text), `birthday` (date), `address` (text), `postal_code` (text), `email_language` (text), `avatar_url` (text), `booking_id_verification_photo_path` (text), `booking_id_verification_status` (text), `public_user_number` (text), `job_request_strikes` (int), `job_requests_blocked_at` (timestamptz) | Trigger `on_auth_user_created` runs `handle_new_user()` on `auth.users INSERT` (user signup). Updated by user via Dashboard (`src/pages/Dashboard.tsx`). |
| **`public.pro_profiles`** | `user_id` (uuid), `business_name` (text), `legal_business_name` (text), `bio` (text), `phone` (text), `website` (text), `location` (text), `business_address` (text), `latitude` (float), `longitude` (float), `service_radius_km` (numeric), `gst_registration_number` (text), `qst_registration_number` (text), `personal_photo_url` (text), `id_document_url` (text), `square_location_id` (text), `email_language` (text), `unavailable_dates` (jsonb), `available_date_overrides` (jsonb) | Pro registration form submission via Supabase SDK (`src/pages/CreateProAccount.tsx` / `src/pages/JoinPros.tsx`). |
| **`public.pro_licenses`** | `pro_profile_id` (uuid), `license_number` (text), `license_type` (text), `holder_name` (text), `is_verified` (bool), `verification_data` (jsonb), `verified_at` (timestamptz) | Pro profile license entry via Pro Dashboard modal (`src/components/pro/ProProfileEditorDialog.tsx`). |
| **`public.pro_photos`** | `pro_profile_id` (uuid), `url` (text), `caption` (text), `is_primary` (bool) | Pro portfolio/photo uploads in Pro Dashboard (`src/components/pro/ProPortfolioEditor.tsx`). |
| **`public.bookings`** | `client_id` (uuid), `pro_profile_id` (uuid), `preferred_date` (date), `preferred_time` (time), `service_duration_minutes` (int), `service_location_choice` (text), `distance_km_snapshot` (numeric), `drive_minutes_snapshot` (int), `invoice_snapshot` (jsonb: contains client full name, client member number, pro name, pro member number, pro legal address, pro GST/QST numbers, service location address, payment amount, date/time), `cancel_policy_snapshot` (text), `cancel_fee_percent_snapshot` (int), `cancel_fee_type_snapshot` (text), `cancel_fee_cents_snapshot` (int), `cancel_policy_acknowledged_at` (timestamptz), `decline_reason` (text) | Client booking submission on pro profile page (`src/pages/ProProfilePage.tsx`). Triggers auto-assign invoice number and public booking code. |
| **`public.job_requests`** | `client_id` (uuid), `description` (text), `category` (text), `postal_code` (text), `city` (text), `province` (text), `latitude` (float), `longitude` (float), `photo_urls` (text[]), `budget_range` (text), `timing` (text), `preferred_date` (date), `preferred_time_window` (text), `moderation_reason` (text), `moderation_removed_by` (uuid) | Client submitting job request via Make a Request flow (`src/pages/MakeRequest.tsx`). |
| **`public.job_quotes`** | `job_request_id` (uuid), `pro_profile_id` (uuid), `price_cents` (int), `estimated_time` (text), `message` (text), `proposed_service_date` (date), `status` (text) | Pro submitting a quote on open customer job request (`src/components/pro/JobRequestQuotesPanel.tsx`). |
| **`public.reviews`** | `pro_profile_id` (uuid), `reviewer_id` (uuid), `rating` (int), `title` (text), `content` (text) | Client submitting review for completed booking (`src/components/pro/ReviewForm.tsx`). |
| **`public.review_photos`** | `review_id` (uuid), `url` (text) | Client attaching photos to pro review (`src/components/pro/ReviewForm.tsx`). |
| **`public.review_responses`** | `review_id` (uuid), `pro_user_id` (uuid), `content` (text) | Pro posting a public reply to client review (`src/components/dashboard/DashboardReviewsPanel.tsx`). |
| **`public.client_reviews`** | `pro_profile_id` (uuid), `client_id` (uuid), `booking_id` (uuid), `rating` (smallint), `content` (text), `photo_urls` (text[]) | Pro submitting review/rating of client after booking (`src/components/dashboard/DashboardReviewsPanel.tsx`). |
| **`public.booking_claim_requests`** | `booking_id` (uuid), `client_id` (uuid), `pro_profile_id` (uuid), `claim_type` (text), `message` (text), `attachment_urls` (text[]), `issue_number` (int), `admin_resolution` (text), `dispute_category` (text), `investigation_notes` (text), `resolution_summary` (text), `refund_amount_cents` (int) | Client opening claim/dispute in Dashboard (`src/components/BookingClaimDialog.tsx`). |
| **`public.payments`** | `booking_id` (uuid), `pro_profile_id` (uuid), `amount_cents` (bigint), `currency` (text), `square_payment_id` (text), `status` (text), `idempotency_key` (text), `card_brand` (text), `card_last_4` (text) | Server-side record inserted by Edge Functions upon Square payment processing (`square-create-payment`, `square-finalize-payment`). |
| **`public.pro_subscriptions`** | `user_id` (uuid), `plan_id` (text), `billing_start` (timestamptz), `billing_cycle_days` (int), `trial_ends_at` (timestamptz), `square_customer_id` (text), `square_card_id` (text), `square_card_fingerprint` (text) | Server-side record created when pro subscribes via Edge Functions (`pro-plan-checkout`, `trial-checkout`). |
| **`public.pro_square_tokens`** | `pro_profile_id` (uuid), `merchant_id` (text), `access_token` (text), `refresh_token` (text), `expires_at` (timestamptz) | Server-side record created when pro connects Square account via OAuth (`square-oauth-callback`). |
| **`public.pro_plan_cancellations`** | `user_id` (uuid), `pro_profile_id` (uuid), `previous_plan_id` (text), `reason_key` (text) | Server-side record inserted when pro cancels paid plan (`pro-plan-cancel`). |
| **`public.referral_invites`** | `inviter_user_id` (uuid), `invitee_email` (text), `invited_user_id` (uuid), `referral_code` (text), `reward_code` (text), `status` (text) | Created when user sends referral invitation via Edge Function (`referral-invite`). |
| **`public.client_saved_pros`** | `user_id` (uuid), `pro_profile_id` (uuid) | Client clicking "Save pro" bookmark (`src/pages/ProListPage.tsx`). |
| **`public.legal_document_acceptances`** | `user_id` (uuid), `document_type` (text), `document_version` (text), `document_hash` (text), `language_displayed` (text), `language_selected` (text), `context` (text), `booking_id` (uuid), `accepted_at` (timestamptz) | User explicitly accepting Terms checkbox at booking or pro registration (`src/lib/legalAcceptance.ts`). |
| **`public.account_deletion_requests`** | `user_id` (uuid), `status` (text), `reason` (text), `requested_at` (timestamptz), `admin_notes` (text) | User clicking "Request deletion" on Dashboard (`src/pages/Dashboard.tsx` line 5384). |
| **`public.apple_pay_handoffs`** | `client_id` (uuid), `booking_id` (uuid), `draft` (jsonb), `square_payment_id` (text), `payment_method_label` (text) | Client initiating desktop-to-mobile Apple Pay handoff (`src/lib/applePayHandoff.ts`). |
| **`public.platform_admin_staff`** | `user_id` (uuid), `full_name` (text), `date_of_birth` (date), `address` (text), `phone` (text), `phone_secondary` (text), `email` (text), `best_contact_method` (text), `additional_info` (text), `member_id` (text), `created_by` (uuid) | Super admin adding staff member in Admin Panel via `manage-platform-admins` Edge Function. |
| **`public.platform_admin_audit_events`** | `actor_user_id` (uuid), `actor_member_id` (text), `action` (text), `target_user_id` (uuid), `target_member_id` (text), `detail` (jsonb) | Automatic server audit log inserted by Edge Function `manage-platform-admins`. |
| **`public.admin_actions`** | `admin_user_id` (uuid), `action` (text), `details` (jsonb) | Admin moderation actions logged in database. |
| **`public.privacy_security_incidents`** | `incident_code` (text), `system_name` (text), `data_affected` (text), `users_affected_estimate` (int), `responsible_person` (text), `investigation` (text) | Manual database logging of privacy or security incidents. |
| **`public.geocode_cache`** | `postal` (text), `lat` (float), `lng` (float), `city` (text), `province` (text), `formatted_address` (text) | Caching of postal code lookups from Google Geocoding API (`src/lib/geocode.ts`). |
| **`public.pro_profile_views`** | `pro_profile_id` (uuid), `created_at` (timestamptz) | Visitor loading a professional's profile page (`src/pages/ProProfilePage.tsx`). |

### Storage Buckets Inventory

| Bucket Name | Access Type | File Types & Content Description |
| :--- | :--- | :--- |
| **`client-booking-verification`** | **Private** (`public: false`) | Government-issued photo ID images uploaded by clients during booking identity verification (`src/lib/clientBookingIdVerification.ts`). Stored at `{userId}/{uuid}.{ext}`. |
| **`booking-evidence`** | **Private** (`public: false`) | Photos, receipts, and supporting documents uploaded by clients or pros for booking dispute claims (`src/components/BookingClaimDialog.tsx`). Stored at `{bookingId}/{uuid}.{ext}`. |
| **`pro-photos`** | **Public** (`public: true`) | Professional profile avatars, business images, portfolio photos, before/after job photos. (Note: Also used for pro private document URLs `personal_photo_url` and `id_document_url` in earlier migrations). |
| **`review-photos`** | **Public** (`public: true`) | Customer review photos documenting completed service work (`src/components/pro/ReviewForm.tsx`). |
| **`job-request-photos`** | **Public** (`public: true`) | Photos uploaded by clients illustrating work needed for job requests (`src/pages/MakeRequest.tsx`). |
| **`pro-public`** | **Public** (`public: true`) | Professional banner images displayed on public pro profiles (`src/components/pro/ProProfileEditorDialog.tsx`). |

### Personal Data Cached or Duplicated Outside the Main Database

#### Browser `localStorage`
- **`sb-<project-ref>-auth-token`**: Supabase Auth session token, JWT, refresh token, user UUID, and user email address. *(Essential)*
- **`premiere-support-history-v2`**: AI chat conversation history threads including user questions, inquiries, and assistant replies (`src/components/HelpFab.tsx`). *(Stored indefinitely in browser until cleared)*
- **`premiere-support-active-id-v2`**: Active AI chat thread ID (`src/components/HelpFab.tsx`).
- **`job_request_drafts_${userId}`**: Client job request drafts containing description, category, budget, postal code, and photo URLs (`src/lib/jobRequestDrafts.ts`).
- **`premiere-browse-postal-v1`**: User's entered postal code, lat, lng, city, province (`src/lib/browsePostalStorage.ts`).
- **`premiere-cookie-consent-v2`**: Cookie consent state JSON (`src/lib/cookieConsent.ts`). *(Essential)*
- **`premiere-cookie-consent`**: Legacy cookie consent status string (`"accepted"` / `"declined"`). *(Essential)*
- **`premiere-locale`**: User's language preference (`'en'` | `'fr'`) (`src/contexts/LanguageContext.tsx`). *(Preference)*
- **`premiere-theme`**: UI theme preference (`'dark'` | `'light'` | `'system'`) (`index.html`). *(Preference)*
- **`premiere-pro-verified-cache-${userId}`**: Cached pro verification boolean (`src/pages/Dashboard.tsx`).
- **`proProfile:${userId}`**: Cached boolean whether user has pro profile (`src/components/Layout.tsx`).
- **`proPlanPaid:${userId}`**: Cached boolean whether pro plan is paid (`src/pages/ProPlansManagement.tsx`).
- **`premiere-active-verified-pro-${userId}`**: Cached active verified pro boolean (`src/hooks/useActiveVerifiedPro.ts`).
- **`premiere-pro-onboarding-v1`**, **`premiere_dash_tour_${userId}`**, **`premiere_whats_new_read_ids`**: Tour completion flags and read announcement IDs.

#### Browser `sessionStorage`
- **`premiere_admin_member_verified`**: Stores `${userId}:${memberId}` for verifying 6-digit staff admin login session (`src/lib/adminMemberGate.ts`). *(Essential)*
- **`premiere_booking_checkout_resume`**: Temporary booking state and payment intent metadata during checkout (`src/lib/bookingCheckoutResume.ts`). *(Essential)*
- **`premiere_geocode_cache_v1`**: Cached postal code to latitude/longitude geocode responses (`src/lib/geocode.ts`).
- **`premiere_oauth_redirect`**: Target URL path for navigation after Google OAuth return (`src/lib/oauthRedirect.ts`).
- **`scroll_restore_${key}`**: Scroll position for page restore (`src/hooks/useScrollRestore.ts`).

#### Browser `document.cookie`
- **`premiere-locale`**: User language selection (`'en'` | `'fr'`), 1-year expiration (`max-age=31536000`), `SameSite=Lax`, `Path=/` (`src/contexts/LanguageContext.tsx`).
- **`premiere_browse_postal`**: Stored postal code string, 1-year expiration (`max-age=31536000`), `SameSite=Lax`, `Path=/` (`src/lib/browsePostalStorage.ts`).
- **`sidebar:state`**: Sidebar collapse state (`'true'` | `'false'`), 7-day expiration (`src/components/ui/sidebar.tsx`).

#### Application & Server Logs
- **Supabase Edge Function Logs**: Edge Functions output runtime execution logs (`console.log`, `console.error`) containing booking IDs, user IDs, error traces, and payment status indicators. Retained by Supabase infrastructure (typically 7 to 30 days depending on plan tier).

---

## 3. Retention & Deletion

### Automatic Data Expiry & Deletion (Cron / TTL / DB Triggers)
- **Automatic Deletion or TTL:** **NOT FOUND IN CODE**.
  - There are **no** `pg_cron` jobs, scheduled database triggers, or automated Edge Function cron workers that delete, expire, or archive personal data.
  - Configuration constants in `src/config/legalConfig.ts` (lines 80–82):
    - `clientIdVerificationDays: null as number | null` (explicitly commented `REVIEW_REQUIRED`)
    - `claimEvidenceDays: null as number | null` (explicitly commented `REVIEW_REQUIRED`)
    - `accountDeletionGraceDays: 30` (explicitly commented `operational default; LEGAL_REVIEW_REQUIRED`)
    - None of these configuration knobs are connected to executable backend deletion code.

### Account Deletion Flows
- **Client Self-Serve Request Flow**:
  - Found at `src/pages/Dashboard.tsx` (line 5384).
  - Clicking "Request deletion" executes:
    ```typescript
    await supabase.from("account_deletion_requests").insert({
      user_id: user.id,
      status: "pending",
      reason: "user_dashboard_request",
      retain_financial: true,
      retain_audit: true,
    });
    ```
  - **What it actually deletes:** **NOTHING**. It only records a row in `account_deletion_requests`.
  - **What it leaves behind:** The `auth.users` authentication record, `profiles` record, `bookings`, `payments`, `reviews`, `job_requests`, uploaded ID verification files, and claims evidence remain entirely intact. No automated worker processes the request.
- **Admin-Triggered Professional Removal**:
  - Found at `supabase/functions/admin-remove-pro/index.ts` (lines 94–96).
  - When an admin removes a professional, the function runs:
    ```typescript
    await adminClient.from("pro_profiles").delete().eq("id", proProfileId);
    ```
  - **What it deletes:** The `pro_profiles` table record.
  - **What it leaves behind:** The user's `auth.users` record, `profiles` record (name, phone, address, birthday), all prior `bookings`, `payments`, `reviews`, `pro_photos` in storage, and ID documents remain intact. The user is merely converted to a normal client account.

### ID Images Retention (Client & Pro)
- **Client Booking ID Verification Images (`client-booking-verification` bucket)**:
  - **Kept indefinitely**.
  - Code check: The only file deletion call is in `src/lib/clientBookingIdVerification.ts` (lines 60–63), which deletes a previous file *only if* the user uploads a replacement ID image. If no replacement is uploaded, the ID image remains stored in the private bucket indefinitely.
- **Professional Government ID Documents (`id_document_url` in `pro_profiles`)**:
  - **Kept indefinitely**.
  - Code check: Stored in Supabase Storage (`pro-photos` or private paths). No automated expiration, retention limit, or purge function exists.

---

## 4. Third-Party Data Flows (Law 25 s.17 Cross-Border Transfers)

### External Services & Specific Personal Data Transmitted

| Service / Provider | Endpoint / Protocol | Specific Personal Data Fields Sent | Purpose |
| :--- | :--- | :--- | :--- |
| **Supabase** *(Hosting Region: **NOT FOUND IN CODE**)* | `https://*.supabase.co` (REST / PostgREST, Auth, Storage, Edge Functions) | User email, hashed passwords, full names, phone numbers, postal codes, physical addresses, birthdays, government ID photos, claim dispute evidence, Square OAuth tokens, IP addresses, session tokens. | Database, user authentication, file storage, backend Edge Functions. |
| **Square** | `https://connect.squareup.com/v2/...` (Payments, Customers, Cards, OAuth APIs) | Client payment token (`source_id`), payment amounts, currency (`CAD`), booking reference IDs, customer IDs, pro subscription tier, pro OAuth tokens (`access_token`, `refresh_token`), card brand, card last 4 digits. Full card numbers are handled directly by Square's Web Payments SDK iframe. | Payment authorization, payment capture, recurring pro subscriptions, seller payouts via Square Connect. |
| **Google Maps / Places / Geocoding** | `https://maps.googleapis.com/maps/api/...` | User keystrokes / search text in address input fields, postal codes, city, province, street addresses, geographic coordinates (latitude / longitude). | Address autocomplete suggestions (`AddressInput.tsx`), postal code geocoding (`src/lib/geocode.ts`), driving distance calculation (`src/lib/drivingDistance.ts`), map rendering. |
| **AI Chat Providers (Google Gemini & Hugging Face)** | `https://generativelanguage.googleapis.com/v1beta/...` (Gemini API) and `https://router.huggingface.co/v1/...` (Hugging Face Mistral model) | User chat queries (which may include user-submitted names, phone numbers, addresses, or project details), prior conversation history turns, intent metadata, matching pro business names/descriptions from service catalog. | Automated customer support assistance (`supabase/functions/ai-chat-hf/index.ts`). |
| **Resend** | `https://api.resend.com/emails` | Recipient email address, recipient name, booking details (service name, date, time, reference code, pricing), dispute claim details, password reset tokens, email verification magic links, referral invitation details. | Outgoing transactional email delivery (`supabase/functions/send-app-email/index.ts`, `send-booking-claim-email`, `referral-invite`). |
| **Twilio** | `https://api.twilio.com/2010-04-01/...` (Messages API) and `https://verify.twilio.com/v2/...` (Verify API) | Client and pro mobile phone numbers (E.164 format), SMS body text containing professional business names, appointment dates, booking codes, client names; SMS OTP verification tokens. | Booking confirmation SMS, 24-hour appointment reminder SMS (`booking-sms-notify`), phone verification OTP (`twilio-verify`). |

### Data Processing Agreements (DPAs) & Privacy Terms
- **DPAs / SCCs / Vendor Privacy Terms:** **NOT FOUND IN CODE**.
  - Code reference: `src/content/privacyContent.ts` (line 79) contains `[REVIEW_REQUIRED — LR-018: transfers / DPAs.]`.
  - `docs/LEGAL_REVIEW_REQUIRED.md` (item LR-018) flags: *"Review DPAs / transfers for Supabase, Square, Resend, Twilio, Google, HF/AI."* No signed or active DPAs are incorporated in the repository.

---

## 5. AI & Automated Systems

### Exact Support AI System Prompts
Found in `supabase/functions/ai-chat-hf/index.ts`:

#### French Support Prompt (`intent === "support_help"`, lines 328–353):
```text
Tu es l'assistant support de Premiere Services (marché canadien de services à domicile). Tu aides clients et pros.

**Style conversationnel (important) :**
- Ne dump pas une longue liste d’étapes d’un coup.
- Pose **une** question courte pour avancer (ex. « Avez-vous déjà un compte Premiere Services ? »).
- Ensuite donne **seulement la prochaine action** avec un lien cliquable.
- Réponses courtes (2–4 phrases). Jamais de phrase coupée. Ne répète pas ton rôle.

**Liens (toujours URL complète https) :**
- Devenir pro : [Join Pros](https://www.premiereservices.ca/join-pros)
- Créer un compte : [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Se connecter : [Log in](https://www.premiereservices.ca/auth?mode=login&redirect=/join-pros)
- Forfaits pro : [Pro plans](https://www.premiereservices.ca/pro-plans)
- Tableau de bord : [Dashboard](https://www.premiereservices.ca/dashboard)
- Support : support@premiereservices.ca · +1 450 910 1400

**Créer un compte pro — parcours guidé :**
1. Demande s’ils ont déjà un compte.
2. Non → lien Sign up ci-dessus. Oui → lien Log in, puis Join Pros.
3. Après connexion → compléter le profil sur Join Pros, puis forfait sur Pro plans.
4. Mentionne qu’une approbation admin peut être requise avant d’apparaître en recherche.
N’invente pas d’autres URLs.

Langue : **français uniquement** (sauf noms propres / URL).
```

#### English Support Prompt (`intent === "support_help"`, lines 354–379):
```text
You are the Premiere Services support assistant for a Canadian home services marketplace. You help customers and pros.

**Conversational style (important):**
- Do **not** dump a long numbered checklist in one reply.
- Ask **one** short clarifying question first (e.g. “Do you already have a Premiere Services account?”).
- Then give **only the next action** with a markdown link AND the full URL on its own line.
- Example format:
  Do you already have an account?
  If not: [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Keep replies short (2–4 sentences). Never cut off mid-sentence. Don’t restate your role.

**Links (always full https URLs, use markdown [label](url)):**
- Become a pro: [Join Pros](https://www.premiereservices.ca/join-pros)
- Create an account: [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Log in: [Log in](https://www.premiereservices.ca/auth?mode=login&redirect=/join-pros)
- Pro plans: [Pro plans](https://www.premiereservices.ca/pro-plans)
- Dashboard: [Dashboard](https://www.premiereservices.ca/dashboard)
- Support: support@premiereservices.ca · +1 450 910 1400 (Mon–Fri, 8am–8pm EST)

**Create a pro account — guided flow:**
1. Ask if they already have an account.
2. No → send the Sign up link above. Yes → Log in link, then Join Pros.
3. After login → complete the pro profile on Join Pros, then choose a plan on Pro plans when prompted.
4. Mention admin approval may be needed before appearing in search.
Don’t invent other URLs.

Language: **English only** (proper nouns / URLs excepted).
```

### UI Disclosure of Artificial Intelligence
- **Floating Help Widget (`src/components/HelpFab.tsx` line 171 & `src/i18n/translations.ts` lines 526, 2346)**:
  - Initial greeting displayed in chat bubble: `"Hi, I'm the Premiere Services AI assistant. How can I help you today?"` / `"Bonjour, je suis l'assistant IA Premiere Services. Comment puis-je vous aider?"`.
- **Support Page (`src/pages/Support.tsx` line 21 & `src/i18n/translations.ts` lines 517, 2337)**:
  - Subtitle states: `"Get help from our AI assistant or browse common questions"` / `"Obtenez de l'aide de notre assistant IA ou consultez les questions fréquentes"`.
- **Booking Flow Assistant (`src/components/BookingServiceAssistantPanel.tsx`)**:
  - Displays `"Booking assistant"` / `"AI Assistant"`.
- **Account Settings & Auth (`src/pages/Auth.tsx` & `src/pages/Dashboard.tsx`)**:
  - Field label: `"Preferred language for emails and AI assistant"` / `"Langue préférée pour les courriels et l'assistant IA"`.

### AI Conversation Logging & Storage
- **Database Storage:** **NOT FOUND IN CODE**. No table for chat conversations exists in the PostgreSQL schema.
- **Client Browser Storage:** All messages and threads are stored in the user's browser `localStorage` under key `premiere-support-history-v2` (`src/components/HelpFab.tsx` line 42; stores up to 10 conversation threads indefinitely until cleared).
- **Backend Logs:** `supabase/functions/ai-chat-hf/index.ts` logs errors and debug metadata via `console.error` to Supabase Edge Function execution logs.

### Automated Ranking, Scoring & Filtering Logic
- **Hard Eligibility Filter (`src/pages/ProListPage.tsx` lines 67, 71–78; `src/lib/filterAdvertiseablePros.ts`)**:
  - A professional **only** appears in public client search results if:
    1. `is_verified === true` (approved by admin).
    2. The professional has an active paid subscription plan (`Starter`, `Growth`, or `Pro`) evaluated by `filterAdvertiseableProIds()`.
- **"Top Picks" Automated Recommendation Algorithm (`get_top_picks` Postgres RPC function)**:
  - Definition in database:
    ```sql
    WITH pro_rating AS (
      SELECT pp.id, pp.business_name,
             (SELECT COALESCE(AVG(r.rating), 0)::numeric(3,2) FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS avg_rating,
             (SELECT COUNT(*)::bigint FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS review_count,
             (SELECT COUNT(*)::bigint FROM public.bookings b WHERE b.pro_profile_id = pp.id AND b.status = 'completed') AS booking_count
      FROM public.pro_profiles pp
      WHERE pp.is_verified = true
        AND EXISTS (SELECT 1 FROM public.pro_services ps WHERE ps.pro_profile_id = pp.id AND ps.category_slug = p_category_slug)
    )
    SELECT pr.id, pr.business_name, pr.avg_rating, pr.review_count, pr.booking_count
    FROM pro_rating pr
    WHERE (pr.booking_count >= 50 OR pr.review_count >= 40)
    ORDER BY pr.avg_rating DESC NULLS LAST, pr.review_count DESC
    LIMIT 3;
    ```
  - Inputs driving "Top Picks":
    - Category match (`p_category_slug`).
    - Verified pro flag (`is_verified = true`).
    - Volume threshold: Minimum **50 completed bookings** OR minimum **40 client reviews**.
    - Sorted by: Average review rating descending (`avg_rating DESC`), tie-broken by total review count descending (`review_count DESC`).
    - Maximum 3 pros selected.
- **Client-Controlled Sorting (`src/pages/ProListPage.tsx` lines 180–205)**:
  - `rating` (default): Highest average rating (`avgRating DESC`).
  - `reviews`: Most reviews (`reviewCount DESC`).
  - `price-low`: Lowest minimum price (`priceMin ASC`).
  - `price-high`: Highest maximum price (`priceMax DESC`).

---

## 6. Consent & Acceptance Logging

### Terms of Service Acceptance
- **Client Initial Registration (`src/pages/Auth.tsx` lines 460–475)**:
  - Displays text link: `"By creating an account you agree to our Terms and Privacy Policy"`.
  - **Database Logging:** **NOT LOGGED**. No record is inserted into `legal_document_acceptances` or `profiles` upon initial signup.
- **Client Booking Acceptance (`src/components/TermsAcceptance.tsx`; `src/lib/legalAcceptance.ts`)**:
  - Implements mandatory scroll-to-bottom gate and checkbox (`id="terms-accept-booking"`).
  - When checked, calls `recordLegalAcceptance()` which inserts a row into `public.legal_document_acceptances`:
    - `user_id`: Client UUID (`auth.uid()`)
    - `document_type`: `"client_booking_terms"`
    - `document_version`: `"2026-03-draft"` (from `src/config/legalConfig.ts`)
    - `document_hash`: `"client-booking-2026-03-draft"`
    - `language_displayed`: `"en"` or `"fr"`
    - `language_selected`: `"en"` or `"fr"`
    - `context`: `"booking"`
    - `booking_id`: Booking UUID or null
    - `accepted_at`: ISO timestamp (`new Date().toISOString()`)
    - **User IP Address:** **NOT LOGGED** (no IP column exists in `legal_document_acceptances`).
- **Professional Registration Acceptance (`src/components/TermsAcceptance.tsx`; `src/lib/legalAcceptance.ts`)**:
  - Implements mandatory scroll-to-bottom gate and checkbox (`id="terms-accept-pro"`).
  - Inserts a row into `public.legal_document_acceptances`:
    - `user_id`: Pro user UUID
    - `document_type`: `"professional_agreement"`
    - `document_version`: `"2026-03-draft"`
    - `document_hash`: `"pro-agreement-2026-03-draft"`
    - `language_displayed`: `"en"` or `"fr"`
    - `language_selected`: `"en"` or `"fr"`
    - `context`: `"pro"`
    - `accepted_at`: ISO timestamp
    - **User IP Address:** **NOT LOGGED**.

### Cancellation Policy Acceptance & Snapshotting
- **Snapshot Location:** Stored directly on the booking row in `public.bookings` (`src/pages/ProProfilePage.tsx` lines 2286–2291):
  - `cancel_policy_snapshot`: String key (`"free"`, `"late_fee"`, or `"no_cancel"`).
  - `cancel_fee_percent_snapshot`: Integer percentage (e.g. `50`, `100`) or null.
  - `cancel_fee_type_snapshot`: String (`"percent"` or `"fixed"`).
  - `cancel_fee_cents_snapshot`: Integer cents for fixed fees, or null.
  - `cancel_policy_acknowledged_at`: ISO timestamp (`new Date().toISOString()`).
- **Policy Text vs. Structured Parameters:** The legal explanatory prose is **not** snapshotted as text on the booking row; only the structured policy enum, fee amounts/percentages, and the acknowledgment timestamp are persisted.

---

## 7. Cookies & Tracking

### Inventory of Cookies & LocalStorage Keys

| Key Name | Storage Mechanism | Data Stored | Classification |
| :--- | :--- | :--- | :--- |
| `sb-<ref>-auth-token` | `localStorage` | Supabase session JWT, refresh token, user UUID, user email | **Essential** (Authentication & session) |
| `premiere-cookie-consent-v2` | `localStorage` | JSON object: `{ necessary: true, preferences: bool, analytics: bool, marketing: bool, updatedAt: string, version: 2 }` | **Essential** (Consent record) |
| `premiere-cookie-consent` | `localStorage` | Legacy consent string: `"accepted"` or `"declined"` | **Essential** (Consent record) |
| `premiere-locale` | `Cookie` & `localStorage` | Language code: `'en'` or `'fr'` (`max-age=31536000`, `SameSite=Lax`, `Path=/`) | **Preference** (Gated by preference consent) |
| `premiere_browse_postal` | `Cookie` & `localStorage` (`premiere-browse-postal-v1`) | Postal code string & location coordinates JSON (`max-age=31536000`, `SameSite=Lax`, `Path=/`) | **Preference** (Browse location persistence) |
| `sidebar:state` | `Cookie` | Boolean string (`'true'` / `'false'`) (`max-age=604800`, 7 days) | **Preference** (UI sidebar open/collapsed) |
| `premiere-support-history-v2` | `localStorage` | Array of AI chat message objects (up to 10 threads) | **Preference / State** (Customer support history) |
| `premiere-support-active-id-v2` | `localStorage` | Active AI chat thread UUID | **Preference / State** |
| `job_request_drafts_${userId}` | `localStorage` | JSON array of in-progress job request drafts | **Preference / State** (User draft persistence) |
| `premiere_admin_member_verified` | `sessionStorage` | String: `${userId}:${memberId}` (verifies 6-digit admin gate) | **Essential** (Session administrative security) |
| `premiere_booking_checkout_resume`| `sessionStorage` | In-flight booking checkout metadata | **Essential** (Checkout session) |
| `premiere_geocode_cache_v1` | `sessionStorage` | JSON map of cached postal code to lat/lng coordinates | **Performance Cache** |
| `premiere_oauth_redirect` | `sessionStorage` | Relative URL path for post-OAuth navigation | **Essential** (Auth routing) |
| `scroll_restore_${key}` | `sessionStorage` | Window scroll position integer | **UI State** |
| `premiere-theme` | `localStorage` | Theme string: `'dark'`, `'light'`, or `'system'` | **Preference** (UI display) |
| `premiere-pro-verified-cache-*` | `localStorage` | Pro verification boolean cache | **Performance Cache** |
| `proProfile:*`, `proPlanPaid:*` | `localStorage` | Pro profile and payment boolean cache | **Performance Cache** |
| `premiere-pro-onboarding-v1` | `localStorage` | String: `"done"` (onboarding tour completed) | **Preference** |
| `premiere_dash_tour_*` | `localStorage` | Tutorial step progress JSON | **Preference** |
| `premiere_whats_new_read_ids` | `localStorage` | Array of announcement UUIDs read by user | **Preference** |

### Cookie-Consent Banner Behavior & Non-Essential Scripts
- **Banner Implementation (`src/components/CookieConsent.tsx`)**:
  - Displayed fixed at bottom of screen if no consent decision is found in `localStorage`.
  - Offers two buttons: `"Refuse non-essential"` / `"Refuser le non essentiel"` and `"Accept"` / `"Accepter"`.
- **What happens when a user declines (`refuseNonEssential` / line 21)**:
  - Calls `setCookieConsent({ necessary: true, preferences: true, analytics: false, marketing: false })`.
  - Writes `{ necessary: true, preferences: true, analytics: false, marketing: false }` to `premiere-cookie-consent-v2`.
  - Writes `"declined"` to legacy key `premiere-cookie-consent`.
  - Fires custom browser event `window.dispatchEvent(new CustomEvent("premiere-cookie-consent"))`.
  - Hides banner.
- **Third-Party Tracking Scripts:** **NOT FOUND IN CODE**.
  - There are **no** third-party analytics (Google Analytics, Google Tag Manager, Segment, PostHog, Mixpanel) or marketing/retargeting pixels (Meta Pixel, TikTok Pixel, LinkedIn Insight) embedded anywhere in `index.html` or client bundles.
  - The function `isCookieAllowed("analytics")` and `isCookieAllowed("marketing")` exist in `src/lib/cookieConsent.ts`, but are never called anywhere in the app to conditionally load external tracking code.

---

## 8. Security Posture

### Row Level Security (RLS) Policies on Personal Data Tables

```
Table: public.profiles
  - "Anyone can view profiles": SELECT for role {public} WITH (true)  <-- CRITICAL: Publicly exposes all profile rows
  - "Moderators read profiles for support": SELECT for {authenticated} WITH (auth_is_platform_moderator() OR user_id = auth.uid())
  - "Users can insert their own profile": INSERT for {public}
  - "Users can update their own profile": UPDATE for {public} WITH (auth.uid() = user_id)

Table: public.services
  - RLS IS DISABLED (rls_enabled: false)  <-- Service catalog table has RLS off

Table: public.pro_profiles
  - "Anyone can view pro profiles": SELECT for {public} WITH (true)
  - "Pros can insert their own profile": INSERT for {public}
  - "Pros can update their own profile": UPDATE for {public} WITH (auth.uid() = user_id)
  - "Pros can delete their own profile": DELETE for {public} WITH (auth.uid() = user_id)
  - "Admin can update any pro profile": UPDATE for {authenticated} WITH (auth_is_platform_moderator())
  - "Premiere platform moderators can update any pro profile": UPDATE for {authenticated} WITH (auth_is_platform_moderator())

Table: public.pro_licenses
  - "Anyone can view verified licenses": SELECT for {public} WITH (is_verified = true)
  - "Pros can add/update/delete their licenses": INSERT/UPDATE/DELETE for {public} (owner check)

Table: public.bookings
  - "Authenticated can create booking": INSERT for {public}
  - "Clients and pros can view own bookings": SELECT for {authenticated} WITH (client_id = auth.uid() OR pro owns profile)
  - "Pro can update own booking": UPDATE for {public} (pro profile owner check)

Table: public.job_requests
  - "Users can insert own job_requests": INSERT for {public} WITH (client_id = auth.uid())
  - "Users can read own job_requests": SELECT for {public} WITH (client_id = auth.uid())
  - "Users can update own job_requests": UPDATE for {public} WITH (client_id = auth.uid())
  - "Pros can read open job_requests for matching": SELECT for {public} WITH (status = 'open')
  - "Moderators read all job_requests": SELECT for {authenticated} WITH (auth_is_platform_moderator())
  - "Moderators update job_requests moderation": UPDATE for {authenticated} WITH (auth_is_platform_moderator())

Table: public.job_quotes
  - "Pros can insert/read/update own job_quotes": INSERT/SELECT/UPDATE for {public} (pro owner check)
  - "Clients can read job_quotes for their job_requests": SELECT for {public} (job request owner check)
  - "Clients can update job_quotes for their jobs": UPDATE for {public} (job request owner check)

Table: public.reviews, public.review_responses, public.client_reviews
  - SELECT for {public} WITH (true)
  - INSERT/UPDATE/DELETE restricted to respective author / reviewer

Table: public.booking_claim_requests
  - "Clients can insert own booking claims": INSERT for {authenticated} WITH (client_id = auth.uid())
  - "Clients can read own booking claims": SELECT for {authenticated} WITH (client_id = auth.uid())
  - "Admin can read/update booking claim requests": SELECT/UPDATE for {authenticated} WITH (auth_is_platform_moderator())

Table: public.payments
  - "Clients can read payments for their bookings": SELECT for {public} (booking client check)
  - "Pros can read own payments": SELECT for {public} (pro profile owner check)
  - "Platform admin can read payments": SELECT for {authenticated} WITH (auth_is_platform_moderator())

Table: public.pro_subscriptions
  - "Users read own pro subscription": SELECT for {authenticated} WITH (user_id = auth.uid())
  - "Platform admin can read pro subscriptions": SELECT for {authenticated} WITH (auth_is_platform_moderator())

Table: public.pro_square_tokens
  - NO POLICIES DEFINED. RLS enabled. Accessible exclusively via service_role in backend Edge Functions.

Table: public.platform_admin_staff
  - "Admins read own staff row": SELECT for {authenticated} WITH (user_id = auth.uid())
  - "Super admin manage platform_admin_staff": ALL for {authenticated} WITH (auth_is_super_admin())

Table: public.platform_admin_audit_events
  - "Super admin read audit": SELECT for {authenticated} WITH (auth_is_super_admin())

Table: public.account_deletion_requests
  - "Users insert own deletion requests": INSERT for {authenticated} WITH (user_id = auth.uid())
  - "Users read own deletion requests": SELECT for {authenticated} WITH (user_id = auth.uid())

Table: public.legal_document_acceptances
  - "Users insert own legal acceptances": INSERT for {authenticated} WITH (user_id = auth.uid())
  - "Users read own legal acceptances": SELECT for {authenticated} WITH (user_id = auth.uid())

Table: storage.objects (Bucket Policies)
  - Bucket `client-booking-verification` (Private):
    - "Users upload/read/update/delete own client-booking-verification": INSERT/SELECT/UPDATE/DELETE for {authenticated} WITH folder = auth.uid().
    - "Pros read client booking verification for their bookings": SELECT for {authenticated} WITH EXISTS in bookings (status IN ('pending', 'accepted', 'completed')).
  - Bucket `booking-evidence` (Private):
    - "Booking parties read/upload/update/delete booking-evidence": SELECT/INSERT/UPDATE/DELETE for {authenticated} if user is client or pro on booking.
  - Buckets `pro-photos`, `job-request-photos`, `review-photos`, `pro-public`: Public SELECT for {public}.
```

### Edge Functions `verify_jwt` Status

| Function Name | `verify_jwt` in `config.toml` | In-Function Authentication Implementation |
| :--- | :--- | :--- |
| **`verify-rbq-license`** | `false` | None / Public |
| **`seed-demo-pro`** | `false` | Admin check in code |
| **`search-suggestions`** | `false` | Public endpoint |
| **`pro-plan-checkout`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`pro-plan-cancel`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`trial-checkout`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`trial-token-admin`** | `false` | In-function admin check via `callerIsPlatformModerator()` |
| **`ensure-platform-admin`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`booking-sms-notify`** | `false` | In-function Bearer JWT or `x-booking-reminder-secret` header |
| **`send-app-email`** | `false` | In-function Bearer JWT or `x-email-pipeline-secret` header |
| **`referral-invite`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`square-oauth-start`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`square-oauth-callback`** | `false` | Public OAuth redirect handler with state parameter verification |
| **`square-oauth-disconnect`** | `false` | In-function Bearer JWT check via `auth.getUser()` |
| **`accept-pro`** | Default (`true` in CLI; `false` in direct deployment) | In-function admin check via `callerIsPlatformModerator()` |
| **`admin-remove-pro`** | Default (`true` in CLI; `false` in direct deployment) | In-function admin check via `callerIsPlatformModerator()` |
| **`ai-chat-hf`** | Default (`true` in CLI; `false` in direct deployment) | Optional Bearer JWT / Public client support chat |
| **`decline-pro`** | Default (`true` in CLI; `false` in direct deployment) | In-function admin check via `callerIsPlatformModerator()` |
| **`geocode`** | Default (`true` in CLI; `false` in direct deployment) | Public / Session lookup |
| **`manage-platform-admins`** | Default (`true` in CLI; `false` in direct deployment) | In-function super admin check (`SUPER_ADMIN_EMAIL`) |
| **`send-booking-claim-email`** | Default (`true` in CLI; `false` in direct deployment) | In-function Bearer JWT check |
| **`send-booking-declined-email`** | Default (`true` in CLI; `false` in direct deployment) | In-function Bearer JWT check |
| **`square-create-payment`** | Default (`true` in CLI; `false` in direct deployment) | In-function Bearer JWT check via `auth.getUser()` (matches client_id) |
| **`square-finalize-payment`** | Default (`true` in CLI; `false` in direct deployment) | In-function Bearer JWT check via `auth.getUser()` |
| **`square-register-apple-pay-domain`** | Default (`true` in CLI; `false` in direct deployment) | Service role key execution |
| **`square-web-config`** | Default (`true` in CLI; `false` in direct deployment) | Public config delivery |
| **`twilio-verify`** | Default (`true` in CLI; `false` in direct deployment) | Public OTP send/check endpoint |

### Multi-Factor Authentication (MFA)
- **MFA / TOTP / WebAuthn Enforcement:** **NOT FOUND IN CODE**.
  - Neither Supabase MFA (`auth.mfa.*`) nor TOTP/two-factor authentication is enforced for user accounts or administrator accounts.
  - Staff Platform Administrators are subject to an application-level gate (`src/components/admin/AdminMemberIdGate.tsx`; `src/pages/Auth.tsx`) requiring entry of their 6-digit `public_user_number` ("Member ID"). This is stored in plaintext in `public.profiles.public_user_number` and stored in `sessionStorage` (`premiere_admin_member_verified`). It is **not** cryptographic MFA.
  - The Super Administrator (`murc137490@gmail.com`) is explicitly exempt from the Member ID requirement.

### Encryption Assessment
- **In Transit**:
  - Encrypted via HTTPS / TLS 1.3 across all client-to-server web traffic, API calls, and Supabase database connections.
  - External API calls to Square, Resend, Twilio, Google Maps, and Hugging Face/Gemini all enforce HTTPS.
- **At Rest (Infrastructure Level)**:
  - Supabase databases and Storage volumes reside on cloud provider infrastructure (AWS EBS and S3) with standard infrastructure-level encryption at rest (AES-256).
- **At Rest (Application / Column Level)**:
  - **Passwords**: Hashed and salted by Supabase Auth (`auth.users.encrypted_password` using bcrypt).
  - **Personal Data Columns**: **Plaintext**. All user personal data in `public.profiles` (full names, addresses, phone numbers, birth dates), `public.pro_profiles` (tax registration numbers `gst_registration_number`, `qst_registration_number`), `public.platform_admin_staff` (DOBs, phone numbers, addresses), and `public.bookings` (invoice snapshot JSON) are stored as plaintext `text`, `date`, or `jsonb`. No column-level encryption (`pgcrypto`) is applied.
  - **Square Tokens**: `access_token` and `refresh_token` in `public.pro_square_tokens` are stored as **plaintext** `text` strings.
  - **Payment Card Data**: Full card numbers and CVVs are never stored on Première Services servers (processed directly via Square Web Payments SDK). Tokenized customer and card IDs (`square_card_id`, `square_customer_id`, `square_card_fingerprint`) are stored as plaintext strings in `public.pro_subscriptions` and `public.payments`.

---

## 9. Minors & Age Gating

### Signup Age Gating & Technical Controls
- **Age Gating at Registration:** **NOT FOUND IN CODE**.
  - In `src/pages/Auth.tsx` (lines 400–515), the signup form requires:
    1. Full Name (`fullName`)
    2. Email Address (`email`)
    3. Password (`password`)
    4. Preferred Language (`emailLanguage`: English or French)
  - There is **no birth date input**, **no age verification checkbox**, and **no birth year gate** during user registration.
- **Contractual Age Representation**:
  - The Terms of Service and draft Privacy Policy (`src/content/privacyContent.ts` Section 10) state: *"The Platform is intended for users 18+. We do not knowingly collect information from children under 18."* However, this is purely contractual notice text; it is not backed by technical blocking at signup.

### Birthday Collection & Age Validation
- **Collection Points**:
  - Optional account profile field on Dashboard (`src/pages/Dashboard.tsx` line 5328): `"Birthday"` / `"Date de naissance"`.
  - Optional field during Pro profile editing (`src/components/pro/ProProfileEditorDialog.tsx` line 798).
- **Validation Logic (`src/lib/birthday.ts` lines 1–18; `src/pages/Dashboard.tsx` line 3297)**:
  - Evaluates `isBirthdayAtLeastMinAge(birthdayRaw, 18)`.
  - Validates that `birthday <= today - 18 years` (`MIN_ACCOUNT_AGE_YEARS = 18`).
  - If a user inputs a birthday indicating they are younger than 18, the profile update is blocked with a validation error.
  - However, because filling out the birthday field on `profiles` is optional, users under 18 can create and use accounts without ever triggering this check.

---

*Report generated directly from repository source code, Supabase database catalog queries, and configuration files.*

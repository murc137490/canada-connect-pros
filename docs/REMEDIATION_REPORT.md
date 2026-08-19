# Legal / accuracy / security remediation report

**Date:** 2026-08-19  
**Scope:** Première Services (`premiereservices.ca`) codebase + applied Supabase migration.

Technical and content remediation has been implemented based on the provided legal issue-spotting audit. Remaining legal questions require review by qualified Quebec counsel and, where applicable, privacy, tax, and insurance professionals.

**Do not claim:** “Première Services is now legally compliant.”

---

## 1. Files changed (high level)

### New
- `src/config/legalConfig.ts`
- `src/content/privacyContent.ts`
- `src/content/cookieContent.ts`
- `src/pages/PrivacyPolicy.tsx`
- `src/pages/CookiePolicy.tsx`
- `src/lib/cookieConsent.ts`
- `src/lib/legalAcceptance.ts`
- `src/lib/demoData.ts`
- `src/components/PrivateNoIndex.tsx`
- `src/lib/bookingInvoiceAmounts.test.ts`
- `docs/LEGAL_REVIEW_REQUIRED.md`
- `docs/PAYMENT_FLOW.md`
- `docs/THIRD_PARTY_DATA_INVENTORY.md`
- `docs/REMEDIATION_REPORT.md` (this file)
- `supabase/migrations/20260819010000_legal_security_remediation.sql`

### Updated (selected)
- `src/App.tsx` — `/privacy`, `/cookies`, aliases, `PrivateNoIndex`
- `src/components/Layout.tsx` — footer legal links
- `src/components/CookieConsent.tsx` — category consent; refuse non-essential
- `src/components/TermsAcceptance.tsx` — FR/EN summaries, checkbox for booking, acceptance logging
- `src/pages/TermsOfService.tsx` — removed “Booking Guarantee” block; service-resolution help
- `src/content/termsContent.ts` — ID status-only, no escrow hold language, FR booking summary
- `src/i18n/translations.ts` — marketing claims, guarantee copy, invoice fee label, dispute categories
- `src/lib/bookingInvoiceAmounts.ts` — central 5% platform fee
- `src/lib/disputeCategories.ts` — expanded claim categories + workflow statuses
- `src/components/BookingClaimDialog.tsx` / `BookingEvidenceGallery.tsx` — private evidence paths + signed URLs
- `src/lib/clientBookingIdVerification.ts` — sets verification status
- `src/pages/Dashboard.tsx` — no pro ID image fetch; deletion request UI; identity status for pros
- `src/components/pro/ProBookingRequestDetailDialog.tsx` — “Identité vérifiée ✓”
- `src/pages/Auth.tsx` — Terms + Privacy on signup
- `public/robots.txt` — disallow private paths
- `src/lib/quebecInvoiceHtml.ts` — platform fee label

---

## 2. Database migrations

Applied (remote + local file): `20260819010000_legal_security_remediation.sql`

- `legal_document_acceptances` (append-only)
- `account_deletion_requests`
- `privacy_security_incidents` (RLS on, no public policies)
- Claims columns: `issue_category`, `workflow_status`, notes, refund amount, replacement/reperformance, `policy_version`
- `profiles.booking_id_verification_status`
- Bookings SELECT tightened (client / pro / platform admin)
- `booking-evidence` bucket set **private** + party-only SELECT
- Removed pro SELECT on `client-booking-verification` objects

---

## 3. RLS policies changed

- Dropped `Anyone can view bookings`; added `Clients and pros can view own bookings` (+ platform admin).
- Legal acceptances / deletion requests: own insert/select.
- Incidents: enabled RLS with no client policies (service_role / future admin).

**Still open (TECHNICAL_REVIEW_REQUIRED):** broad `Anyone can view profiles` and public SELECT on several marketplace tables.

---

## 4. Storage policies changed

- `booking-evidence`: `public=false`; authenticated booking-party read only.
- Pro read of client ID verification objects: removed.
- `client-booking-verification` remains private (owner CRUD).
- `pro-photos`, `review-photos`, `job-request-photos`, `pro-public`: still public (portfolio / browse use). Further lockdown of job-request / evidence-like public media: TECHNICAL_REVIEW_REQUIRED.

---

## 5. Edge Functions changed

None in this pass. AI minimization documented in `THIRD_PARTY_DATA_INVENTORY.md`.

---

## 6. Security fixes

- Bookings no longer world-readable via anon RLS.
- Claim evidence no longer public-URL readable by default.
- Pros no longer receive client government ID image URLs.
- Private routes get `noindex` meta + robots Disallow.

---

## 7. Privacy fixes

- Live Privacy Policy routes (FR/EN content with REVIEW_REQUIRED markers).
- Cookie Policy + consent categories (analytics/marketing off until accept).
- Privacy contact / entity name placeholders in `legalConfig`.
- Account deletion **request** workflow (not auto-wipe).
- ID: status to pros, not image.

---

## 8. Payment fixes

- Customer-facing fee labeled **Platform fee (5%)** consistently via `PLATFORM_FEE_RATE`.
- Documented Connect `app_fee` (~2.1%) as implementation detail — not advertised as Square’s card rate.
- Removed escrow / “hold until completion” Terms language; see `PAYMENT_FLOW.md`.
- Refunds remain non-automatic.

---

## 9. Marketing changes

Removed/softened: fastest-growing, thousands, partout au Canada, payé à temps, licensed local pros, satisfaction guarantee.

---

## 10. Legal-document changes

- Separate Privacy + Cookie pages.
- Terms: service-resolution help (non-binding), ID/status, payment accuracy flags.
- Versioned acceptance logging table + client recording on checkbox.
- FR booking / pro summaries for French-first display.

---

## 11. Tests performed

- Added `src/lib/bookingInvoiceAmounts.test.ts` (5% consistency).
- Manual: migration apply succeeded via Supabase MCP.
- Full suite not run in CI here — recommend `npm test` / `vitest` locally.

---

## 12. Remaining LEGAL_REVIEW_REQUIRED

See `docs/LEGAL_REVIEW_REQUIRED.md` (LR-001 … LR-018), including: entity name, privacy officer identity, Privacy/Cookie final wording, guarantee/claims remedies, ID retention, cancellation fee enforceability, fee disclosure, payment characterization, French-first contracts, deletion retention, incident notification, DPAs.

---

## 13. Remaining TECHNICAL_REVIEW_REQUIRED

- Tighten `profiles` / other “Anyone can view” RLS without breaking public marketplace.
- Private `job-request-photos` if home-interior sensitivity requires it.
- Admin UI for claims workflow statuses + incident register.
- Wire Square Refunds API for counsel-approved claim/cancel outcomes.
- Automate deletion fulfillment (edge job) after counsel retention rules.
- Confirm Square live fee schedule vs any residual 2.9% comments in old docs.
- Support AI knowledge pack refresh from new copy.
- TypeScript types regeneration for new tables (`supabase gen types`).

---

## 14. Assumptions

- Owner will fill `LEGAL_ENTITY_NAME` and `PRIVACY_CONTACT` real identity.
- 5% remains the customer/pro-facing platform fee (per instructions).
- Showing “Identity verified” without ID image is the desired product posture until counsel says otherwise.
- Public portfolio/review photos may stay public for marketplace UX.
- Draft Privacy/Cookie/Terms text is interim and marked for counsel.

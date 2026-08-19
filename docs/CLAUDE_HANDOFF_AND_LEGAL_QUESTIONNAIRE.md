# PREMIÈRE SERVICES — FULL HANDOFF FOR CLAUDE + LAWYER QUESTIONNAIRE

**Purpose:** Give Claude (or any AI) the same operational picture of premierservices.ca that was assembled from the codebase, then a complete set of legal questions for a Quebec lawyer.  
**Site:** https://www.premiereservices.ca  
**Repo / product name:** canada-connect-pros / Première Services  
**Stack:** React + Vite frontend, Supabase (Auth, Postgres, Storage, Edge Functions), Vercel hosting patterns, Square payments, bilingual FR/EN.  
**Terms last updated (in-app copy):** March 2026 / mars 2026.  
**Important:** This is a **factual product inventory + question list**, not legal advice. Claude is not a lawyer. An actual Quebec lawyer must review.

---

# PART 1 — PRODUCT BRIEFING (FEED THIS TO CLAUDE FIRST)

## 1.1 What Première Services is

Première Services is a bilingual (French / English) **Canadian home-services marketplace**. Clients find local professionals by postal code, can post a job request to get quotes, or book a verified pro directly on their profile. Pros create a business profile, wait for admin verification, subscribe to a paid plan (Starter / Growth / Pro), respond to bookings and leads, and may collect payment through Square. There is **no dedicated in-app private chat** between client and pro (only quote messages, booking auto-replies, dashboard flags, optional email/SMS, and platform support AI).

Brand: **Première Services**. Support email used in product: **support@premiereservices.ca**.

## 1.2 Tech & third parties (from code)

| Layer | Details |
|-------|---------|
| Frontend | React/Vite, i18n EN/FR, dark/light theme |
| Hosting | Vercel-oriented (`vercel.json`) |
| Backend | Supabase: Auth, Postgres, RLS, Storage, Realtime, Edge Functions |
| Payments | **Square** (primary). Stripe Edge/UI exists in repo but is largely **not wired** into current booking UI |
| Maps / geocode | Google Maps/Places/Geocoding; Edge `geocode` also uses geocoder.ca / Zippopotam (FSA only) / Photon fallback; durable `geocode_cache` for some LDUs |
| AI | Edge `ai-chat-hf` → Hugging Face chat router (support Help FAB + `/support`). Booking assistant AI is **Pro-tier** gated |
| Email | Resend / `send-app-email` patterns |
| SMS | Twilio functions exist (verify, booking notify); Pro tier SMS automation gated |
| Auth | Email/password, Google OAuth; preferred email language EN/FR on profile |

**Do not paste API keys, service-role keys, or OAuth secrets into Claude.**

## 1.3 User types

1. **Client** — any authenticated user; browse, request, book, pay, review, save pros, submit claims, use support AI when logged in.  
2. **Pro** — has `pro_profiles` row; public listing requires `is_verified = true` (admin accept).  
3. **Platform admin** — `profiles.is_platform_admin` / email allowlist; accept/decline/remove pros, moderate jobs, issue reports, trials, etc.

Minimum age in Terms: **18+**.

## 1.4 Customer journey (actual product)

1. Land on `/` — postal + need; marketing.  
2. Browse `/services` → category → pro list (postal often required).  
3. Optional `/make-request` → `job_requests` + photos.  
4. Pros send `job_quotes`; client accepts/declines in Dashboard.  
5. Or book on `/pros/:proId` (service, date/time, location, **ID photo**, Terms scroll).  
6. Booking starts **`pending`**; payment via Square typically **after pro accepts** (or when accepting a quote).  
7. Service performed offline.  
8. Reviews (client→pro and pro→client possible).  
9. Support: `/support` or Help FAB → AI (session required). Claims via `booking_claim_requests`.

**Important:** Pay is **not** always immediate at “Book”; invoice copy says payment after acceptance in the booking path.

## 1.5 Provider journey (actual product)

1. Account → `/join-pros` → plan `/pro-plans` → `/create-pro-account` / profile editor.  
2. Business info, services, area, photos, ID/selfie, tax fields (GST/QST numbers), etc.  
3. Starts `is_verified = false` until admin `accept-pro`.  
4. Subscription: Starter / Growth / Pro via Square `pro-plan-checkout`; optional Growth trials.  
5. Dashboard: bookings, nearby jobs, quotes, schedule, Square Connect OAuth, tier-gated features.  
6. Client pays via Square Connect (seller + app fee) or legacy platform merchant if no Connect.

## 1.6 Plans & fees (marketing + code)

| Plan | Listed price | Request access (code) | Notes |
|------|--------------|----------------------|--------|
| Starter | CA$20 / month | ~20 | Testing the platform |
| Growth | CA$27 / month | ~50 | Stronger profile, schedule/calendar extras, bundles/auto-reply |
| Pro | CA$32 / month | No UI cap | SMS automation, booking AI assistant |

- Clients: marketplace use is free; they pay the **service price** (+ taxes/fees shown at checkout).  
- Paid pro plans: Terms/UI describe ~**5%** platform fee on **completed transactions paid through the platform**. Square Connect code also applies ~**2.1%** `app_fee_money` on service subtotal — **fee messaging is dual-described; lawyer should reconcile**.  
- Pre-existing pro–client relationships may stay off-platform per Terms; **new** clients from Première follow platform payment rules when charging through the site.  
- Refunds: Terms say case-by-case, not guaranteed. Admin can mark claims `refunded`. **No automated Square Refund API found in code.**  
- Cancel/reschedule: clients see and must accept a **per-service** (or account-default) policy at booking: free / late fee under 24h (fixed $ or 25–50–75%) / no-cancel full charge. Snapshotted on booking. **Square partial refunds for fixed fees not fully automated yet.**

## 1.7 Account / ID verification

- Client ID: front of ID only; stored for booking verification; **not** on public profile; assigned pro may view for identity check. Dashboard → My account → yellow shield collapsible section.  
- Pro: ID/selfie in application for admin verification.  
- Postal/address on My account; postal used for nearby search and receipts.

## 1.8 Personal data categories (high level)

Name, email, phone, address, postal, birthday, geolocation of postal/pro, profile/work photos, **government ID images**, business/tax numbers, booking/appointment data, payment metadata (amount, status, card brand/last4, Square IDs), reviews, claim evidence, AI chat content (sent to HF; often localStorage history), cookies/local prefs.  

**Privacy Policy route `/privacy` is linked in places but was NOT FOUND as a matching page in App routes at last audit (March–Aug 2026 fact-finding).** This is a major gap.

Cookie consent is UI + localStorage only (no full CMP noted).

## 1.9 Storage buckets (flags from audit)

| Bucket | Public? |
|--------|---------|
| booking-evidence | public |
| client-booking-verification | **private** |
| job-request-photos | public |
| pro-photos | public |
| pro-public | public |
| review-photos | public |

## 1.10 Security / RLS notes from audit (worry list for counsel)

- Many tables have RLS enabled, but some policies are named broadly (e.g. **“Anyone can view bookings”**, **“Anyone can view profiles”**, **“Anyone can view pro profiles”**, reviews similarly). Counsel should verify what “Anyone” means in practice (anon vs authenticated).  
- `public.services` had **RLS disabled** (advisor critical at inspection).  
- Some Edge Functions deployed with **`verify_jwt: false`** (e.g. geocode, and historically square-create-payment noted) — review exposure.  
- Square OAuth tokens in `pro_square_tokens` — treat as secrets.  
- Self-serve **account deletion** not found.  
- Dedicated **suspension flag workflow** not found (Terms allow suspension).  
- Pro Terms acceptance: UI gating; **no DB column recording acceptance found**.  
- No payment **webhooks** found in inventory.  
- No product analytics SDK (GA/gtag) found in `src` (hosting may still log).

## 1.11 Support AI — intended behavior (product intent)

- Only answer Première Services topics (account, booking, plans, payments, ID, how the site works).  
- Refuse off-topic (homework, shopping, weather, medical/legal advice as general AI, etc.).  
- Prefer short answers; point to **support@premiereservices.ca**.  
- Knowledge should come from a controlled pack (not open web search).  
- Owner exploring Google Gemini / OpenAI instead of Hugging Face; daily token ceiling desired; keys only in Supabase secrets.

## 1.12 Support Q&A answers (approved product copy style)

Use these as support knowledge. Flagged items need owner confirmation.

### Account
- **Create account:** `/auth?mode=signup` — name, email, password, phone, language; confirm email if required.  
- **Reset password:** login page reset → email link; if missing, support@.  
- **Email language:** Dashboard → My account → preferred language for emails/AI → Save.  
- **Dashboard:** menu “My Dashboard” / `/dashboard`.  
- **Postal/address:** Dashboard → My account → save.

### Booking
- **Book near me:** postal → search/browse → pro profile → booking wizard.  
- **Why postal:** local matching + distance/receipts context.  
- **After request:** pro accept/decline/quote; updates in dashboard (+ possible email/SMS).  
- **Cancel/reschedule:** Per service (or pro default): free; or fee if cancel under 24h (fixed $ or 25/50/75%); or no cancel = 100% charge. Shown + accepted at booking. Partial refunds after Square pay are manual/API later.  
- **Declined:** pro refused (busy, out of area, etc.); try another pro or support.

### ID
- Front only; verification for assigned pro; not public; replace in My account (yellow shield).

### Payments
- Pay on-platform via Square when checkout runs.  
- Clients: free to use marketplace; pay service price + shown taxes/fees.  
- Pros: ~5% platform fee messaging on completed platform-paid jobs; Connect app fee ~2.1% in code — **reconcile**.  
- Refunds: case-by-case, not guaranteed.

### Plans
- Starter CA$20 / ~20 requests; Growth CA$27 / ~50; Pro CA$32 / no UI cap + SMS + booking AI.  
- Become pro: apply → admin verify → plan.  
- **Unpaid pros do not appear in client search / cannot advertise bookings** (product rule).

### Safety
- Pros verified (ID/licence where applicable).  
- Contact: support@premiereservices.ca.  
- Coverage: expanding city-by-city; check postal on site.

### Refusal examples
- Off-topic schoolwork / weather / retail shopping / medical/legal general advice / coding homework → refuse, redirect to Première-only + support@.

## 1.13 Owner open product decisions (tell Claude these are unsettled)

1. Automating Square partial refunds for late-cancel fixed/$% fees.  
2. Whether fee display is always 5% vs Connect 2.1% + card fees.  
3. Which cities are “live” for marketing claims.  
4. Whether Privacy Policy page is published yet.  
5. Final LLM vendor (HF vs Gemini vs OpenAI) and daily token ceiling.  
6. KYC vendor vs in-app vision checks for ID images.

**See also:** `docs/PERPLEXITY_HANDOFF_AND_RESEARCH.md`, `docs/LEGAL_QUESTIONNAIRE_EXHAUSTIVE.md`, `docs/SUPPORT_AI_QA_KNOWLEDGE_PACK.md`.

---

# PART 2 — LEGAL QUESTIONNAIRE FOR QUEBEC COUNSEL

**Instructions for Claude:** Organize answers as issue → risk → recommended document/process → priority. Do **not** invent Quebec law. Mark “needs Quebec counsel confirmation.” The human will send this to a real lawyer.

**Instructions for the lawyer:** Please advise under Quebec civil law / consumer protection / privacy (Law 25 / private sector), PIPEDA interaction if any, tax (GST/QST), payments, marketplace intermediary liability, employment vs independent contractor, and platform contract enforceability. Call out **gaps between Terms and actual product behavior**.

## A. Corporate / structure
1. What legal entity should operate Première Services (inc., CBCA, etc.) and where should it be registered?  
2. What licenses/permits (municipal, provincial) are needed for a home-services marketplace?  
3. Are we a “marketplace facilitator,” “broker,” or “agent” for tax/consumer purposes?  
4. What insurance (E&O, cyber, commercial general) is recommended?  
5. How should we document that pros are **independent contractors**, not employees?  
6. Cross-border: if a client or pro is outside Quebec/Canada, what extra rules apply?

## B. Terms of Service & contracts
7. Are current Terms (March 2026) adequate for a two-sided marketplace with Square payments and ID collection?  
8. How must Terms be accepted so they bind (clickwrap, scrollwrap, logging acceptance with timestamp/version/IP)?  
9. Pros: UI accepts Terms but **no DB record of acceptance** — what is required?  
10. Separate Professional Service Provider Agreement vs consumer Terms — any missing clauses?  
11. Limitation of liability, indemnities, and Quebec consumer rules that cannot be waived.  
12. Mandatory arbitration / class action waivers — enforceability in Quebec?  
13. Governing law / forum selection (Quebec) — sufficient?  
14. How to update Terms and notify users lawfully?

## C. Privacy / Law 25 / PIPEDA
15. We link to `/privacy` but **no Privacy Policy page was found in routes** — urgency and contents required?  
16. Is a Privacy Officer / contact designation required on the site?  
17. Lawful bases / purposes for each data category (account, ID images, location, payments, AI chats, reviews)?  
18. Do we need consent vs contractual necessity for booking ID photos shown to pros?  
19. Cross-border transfers: Supabase, Square, Hugging Face/Google AI, Resend, Twilio, Google Maps — disclosure and contracts (SCCs / vendor DPAs)?  
20. Retention schedules for ID images, payment metadata, bookings, AI logs?  
21. Access, correction, deletion (right to be forgotten) — we lack self-serve delete — what process is required?  
22. Breach notification timelines and playbook?  
23. Children’s data: Terms say 18+ — enough, or need age-gating UX?  
24. Cookie consent: localStorage banner only — enough under Law 25 / ePrivacy-style expectations?  
25. Can reviews and profile photos remain public after account closure?

## D. Government ID & biometrics-adjacent
26. Collecting government ID images from clients and pros — legal limits and safeguards?  
27. Showing client ID to the **assigned pro only** — is that lawful disclosure? For how long may pro retain/view?  
28. Storage: private bucket for client ID vs public buckets for other media — is that enough?  
29. Prohibition on copying ID images in Terms — enough for pros? Need training/UI warnings?  
30. Selfie + ID for pros — any biometric/Law 25 heightened obligations?  
31. Should we avoid storing ID after verification and switch to a third-party KYC vendor?

## E. Payments, money handling, fees
32. Square Connect (seller charge + app fee) vs charging platform merchant — which models are allowed and how to disclose?  
33. UI shows ~5% “card & platform” while Connect code uses ~2.1% app fee — legal risk of inconsistent disclosure?  
34. Are we holding customer funds / escrow? Terms say may collect/hold; code uses immediate capture — reconcile language.  
35. Subscription billing, trials (card on file, $0 today), proration, cancellation — consumer rules for recurring payments in Quebec?  
36. Refund policy “case-by-case, not guaranteed” — compliant with consumer protection?  
37. Chargebacks / disputes — platform duties vs pro duties?  
38. GST/QST: marketplace facilitator rules; who remits tax on service vs platform fees; invoice requirements (Quebec-style invoices exist in product)?  
39. Pro GST/QST registration numbers collected — validation obligations?  
40. No payment webhooks found — operational/legal risk for payment state integrity?  
41. Orphan Stripe code paths — should they be removed to avoid dual-processor confusion?

## F. Marketplace liability & safety
42. Liability when a pro injures a client, damages property, or commits fraud?  
43. Liability for unverified or falsely verified pros?  
44. Background checks / licence verification — what is “enough,” and how to avoid guaranteeing safety?  
45. No-show / incomplete work — platform mediation obligations?  
46. Replacement pro / rebooking language in Terms — creating obligations?  
47. Claims workflow (`booking_claim_requests`) — sufficient process documentation?  
48. Pro reviewing clients (client_reviews) — defamation / privacy risks?  
49. Public job request photos — privacy of home interiors?  
50. Minors in the home during services — guidance in Terms?

## G. Employment / competition / leads
51. Could pros claim employee/dependent contractor status?  
52. Exclusivity / anti-circumvention (taking clients off-platform) — enforceable in Quebec?  
53. Pre-existing clients off-platform vs new clients on-platform fee rules — clear enough?  
54. Lead limits by tier — advertising “leads” without guaranteeing jobs — misleading advertising risk?  
55. Referral / trial token programs — contest/loyalty or tax issues?

## H. Marketing & consumer advertising
56. “Verified pros,” “satisfaction guarantee,” “expanding across Canada” — substantiation needed?  
57. Price claims (CA$20/27/32) — must match checkout always?  
58. Bilingual obligations (Charter of the French Language / Bill 96) for contracts, UI, invoices, support?  
59. Testimonials/reviews — disclosure if incentivized?

## I. Intellectual property & content
60. Ownership of user photos, reviews, portfolio — licence grants in Terms sufficient?  
61. DMCA/notice-and-takedown equivalent for Quebec/Canada?  
62. Use of Google Maps / brand assets — compliance with Google ToS?

## J. AI / automated decision-making
63. Support AI and booking AI: disclosures required when users talk to AI?  
64. Sending chat content to Hugging Face / future Gemini/OpenAI — privacy notice and retention?  
65. Risk of AI inventing policies/refunds — mitigation and liability?  
66. Using AI for pro category suggestions / moderation — automated decision rules under Law 25?  
67. Training AI only on Première knowledge — still need logging/consent?

## K. Security & cybersecurity
68. Broad RLS SELECT policies (“Anyone can view bookings/profiles”) — acceptable residual risk?  
69. Edge Functions with `verify_jwt: false` — acceptable for which endpoints?  
70. Storing Square OAuth tokens — encryption / access controls required?  
71. Public storage buckets (evidence, job photos) — sensitive data exposure?  
72. Admin email allowlist — MFA / access control expectations?  
73. Incident response / penetration testing expectations for a payments marketplace?

## L. Operations missing in product (gap analysis)
74. No self-serve account deletion — legal process?  
75. No Privacy Policy page live — priority?  
76. No recorded Terms acceptance for pros — priority?  
77. No automated refunds — must refunds be manual with SLA?  
78. No in-app chat — does that increase or decrease risk?  
79. Phone verification Edge exists but unused — collect phone without verify: risk?  
80. Password minLength 6 on signup vs 8 on reset — policy consistency?

## M. Tax / accounting
81. Chart of accounts for subscriptions vs app fees vs service pass-through?  
82. Year-end slips / T4A / Relevé for pros if any amounts are reportable?  
83. Record retention for invoices/payments under tax law?

## N. Disputes & enforcement
84. How should we handle police requests for ID images / booking data?  
85. How long to preserve evidence after a claim?  
86. Can we ban users and publish reasons?  
87. Small claims / civil liability scenarios — platform as defendant?

## O. Launch / expansion checklist
88. Minimum legal pack before public launch in Quebec (Terms, Privacy, cookies, payment disclosures, contractor agreement)?  
89. Extra requirements before expanding to other provinces?  
90. Anything else worrying given: marketplace + Square + government ID + AI + bilingual Canada/Quebec?

---

# PART 3 — HOW TO USE THIS WITH CLAUDE

1. Paste **PART 1** entirely into a new Claude Project or long chat as “Project knowledge.”  
2. Say: “You are my product/ops co-pilot for Première Services. Use only this briefing. Flag unknowns. Don’t invent legal conclusions.”  
3. Paste **PART 2** and say: “Prepare a briefing memo for my Quebec lawyer: prioritize top 20 risks, map each to docs/process gaps, list questions I must answer. Do not claim to be a lawyer.”  
4. Send Claude’s memo + this file + live Terms URL to the real lawyer.  
5. Never paste production secrets, customer PII dumps, or live ID images into Claude.

---

# PART 4 — QUICK LINKS / ROUTES (PRODUCT MAP)

| Area | Route / location |
|------|------------------|
| Home | `/` |
| Auth | `/auth` |
| Services | `/services` |
| Make request | `/make-request` |
| Pro profile | `/pros/:proId` |
| Dashboard | `/dashboard` |
| Join pros | `/join-pros` |
| Create pro | `/create-pro-account` |
| Plans | `/pro-plans` |
| Terms | `/terms` |
| Privacy (linked) | `/privacy` — **page may be missing** |
| Support | `/support` |
| Contact email | support@premiereservices.ca |

---

**End of handoff document.**

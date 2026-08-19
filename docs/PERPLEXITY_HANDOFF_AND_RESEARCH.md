# PREMIÈRE SERVICES — HANDOFF FOR PERPLEXITY (+ MULTI-AI NOTES)

**Purpose:** Same product ground truth as the Claude handoff, rewritten for **Perplexity** (web research with citations). Use this to research Quebec/Canada marketplace law, Square rules, Law 25, and gaps — then send citations + a short memo to a **human Quebec lawyer**.  
**Companion files:**  
- `docs/CLAUDE_HANDOFF_AND_LEGAL_QUESTIONNAIRE.md` (full product + questionnaire)  
- `docs/LEGAL_QUESTIONNAIRE_EXHAUSTIVE.md` (longer question list)  
- `docs/SUPPORT_AI_QA_KNOWLEDGE_PACK.md` (approved support answers)  

**Site:** https://www.premiereservices.ca  
**Support:** support@premiereservices.ca  
**Stack:** React/Vite, Supabase, Square, bilingual FR/EN.  
**Not legal advice.** Perplexity is not a lawyer.

---

# PART 0 — HOW TO USE THIS IN PERPLEXITY

## Paste order

1. Paste **PART 1 (product facts)** first. Say: *“Treat PART 1 as ground truth about what the product does. Do not invent product features. If the live site differs, note the conflict and cite the URL.”*  
2. Paste **PART 2 (research missions)** and ask Perplexity to answer with **sources** (statutes, Square docs, OPC/CAI, Quebec CPA, etc.).  
3. Optionally paste questions from `LEGAL_QUESTIONNAIRE_EXHAUSTIVE.md` in batches of 10–15 (Perplexity handles research better in focused chunks than one mega-paste).  
4. Ask for a **lawyer-ready brief**: top risks → what counsel must decide → links/citations → documents to draft.  
5. **Never** paste API keys, service-role keys, customer PII, or ID images.

## Perplexity settings tips

- Prefer **Pro / Research** mode when available (deeper citations).  
- Ask explicitly: *“Cite primary sources (laws, regulators, Square official docs). Prefer .gc.ca / quebec.ca / squareup.com. Flag when a source is secondary (blog/Reddit).”*  
- Separate chats: (A) privacy Law 25, (B) payments/Square, (C) consumer/marketplace liability, (D) French language / bilingual. Mixing everything in one thread increases hallucination risk.  
- After research, ask: *“List what you could NOT confirm from primary sources.”*

---

# PART 1 — PRODUCT FACTS (GROUND TRUTH — DO NOT OVERRIDE WITH WEB SEARCH)

## 1.1 What it is

Première Services is a bilingual (FR/EN) **Canadian home-services marketplace**. Clients find local pros by postal code, post job requests for quotes, or book a verified pro on their profile. Pros create a profile, wait for admin verification, subscribe to a **paid** plan (Starter / Growth / Pro), handle bookings/leads, and may collect payment through **Square**. There is **no dedicated in-app private chat** between client and pro.

## 1.2 Tech & vendors

| Layer | Details |
|-------|---------|
| Frontend | React/Vite, i18n EN/FR |
| Backend | Supabase (Auth, Postgres, RLS, Storage, Edge Functions) |
| Hosting | Vercel-oriented |
| Payments | **Square** (primary). Stripe code exists but is largely unwired |
| Maps | Google Maps/Places/Geocoding; Edge `geocode` + `geocode_cache` |
| Support AI | Edge → Hugging Face today; owner exploring Gemini/OpenAI |
| Email / SMS | Resend; Twilio (Pro-tier SMS gated) |

## 1.3 Plans & visibility (confirmed product rules)

| Plan | Price | Notes |
|------|-------|--------|
| Starter | CA$20/mo | ~20 requests |
| Growth | CA$27/mo | ~50 requests; extras (auto-reply, renewal, bundles) |
| Pro | CA$32/mo | No UI request cap; SMS + booking AI |

- **Paid plan required** to appear in client search and take marketplace bookings. Pros may onboard/explore the dashboard without advertising.  
- Clients: free to use marketplace; pay service price (+ taxes/fees at checkout).  
- Platform fee messaging ~**5%** on completed platform-paid jobs; Square Connect code also uses ~**2.1%** `app_fee_money` — **inconsistent; counsel must reconcile**.  
- Payment usually **after the pro accepts** (not always at “Book”).  
- **No automated Square Refunds API wired** yet — refunds/case handling are largely manual/case-by-case in Terms.

## 1.4 Cancellation policy (updated)

Pros set cancellation on **each service** (My Services → Add/Edit) and/or a **default** under My Account:

1. **Free cancellation**  
2. **Late fee if cancel &lt; 24 hours** — either a **fixed $ amount** (e.g. $60 massage + $20 fee → ~$40 refunded if already paid) or **25% / 50% / 75%** of price  
3. **No cancellation / full charge (100%)**

Clients see a highlighted box at booking and must **checkbox-accept**. Policy is **snapshotted** on the booking. Enforcing fixed-fee refunds after payment requires a **Square partial refund** (not fully automated in product yet).

## 1.5 ID verification

- Clients: front of government ID for booking verification; private storage; assigned pro may view; replace via Dashboard → My account (yellow shield).  
- Pros: ID/selfie in application for admin verification.  
- Product does **not** currently run a trained KYC model; owner considering vision API or vendor (Persona/Jumio).

## 1.6 Known legal/product gaps (from audit)

- `/privacy` linked but **Privacy Policy page may be missing** from routes.  
- Pro Terms acceptance: UI gating; **no DB acceptance record** found.  
- No self-serve account deletion found.  
- Some broad RLS policies (“Anyone can view…”); some Edge Functions with `verify_jwt: false`.  
- Cookie banner = UI + localStorage only.  
- Support AI knowledge should stay **closed** (approved pack), not open web search in production.

## 1.7 Core routes

`/`, `/auth`, `/services`, `/make-request`, `/pros/:proId`, `/dashboard`, `/join-pros`, `/create-pro-account`, `/pro-plans`, `/terms`, `/privacy` (may 404), `/support`.

---

# PART 2 — RESEARCH MISSIONS FOR PERPLEXITY

Run these as **separate** queries. For each: summarize in plain English → cite primary sources → say what a Quebec lawyer must decide → list docs Première should draft.

## Mission A — Privacy (Law 25 / PIPEDA)

Research Quebec **Law 25** / private-sector privacy obligations for a marketplace that stores **government ID images**, booking addresses, payment metadata, and AI chat logs, with vendors in the US (Supabase, Square, HF/Google AI, Twilio, Resend, Google Maps). Cover: Privacy Officer, privacy policy contents, consent vs necessity for ID shown to pros, cross-border transfers/DPAs, retention, breach notification, cookie consent, right to deletion when there is no self-serve delete.

## Mission B — Payments & Square marketplaces

Research Square **Connect / marketplace / seller** models for platforms that take an **application fee**, charge after booking acceptance, and may issue **partial refunds** for cancellation fees. Cover: fund holding / escrow language risk, recurring subscriptions/trials, consumer disclosure of fees (5% vs 2.1%), chargebacks, Quebec GST/QST marketplace facilitator rules if any, invoice requirements.

## Mission C — Marketplace liability & contractors

Research Quebec civil / consumer protection angles for a two-sided home-services marketplace: intermediary vs agent, limitation of liability, pro as independent contractor vs employee risk, verified-pro marketing claims, no in-app chat, claims/dispute process, anti-circumvention / taking clients off-platform.

## Mission D — French language & bilingual UI

Research Charter of the French Language / Bill 96 expectations for contracts, invoices, support, and public-facing UI for a Quebec-focused bilingual marketplace.

## Mission E — AI disclosures

Research Canadian/Quebec expectations when a logged-in support chatbot answers product questions (and may invent refund/cancel rules). Cover disclosure that the user is talking to AI, logging, and risk of automated decision-making under Law 25.

## Mission F — ID / KYC

Research whether storing government ID images in-app vs using a third-party KYC vendor is preferred practice for Canadian marketplaces; retention limits; showing ID to the assigned service provider.

---

# PART 3 — OUTPUT FORMAT ASK PERPLEXITY TO USE

```markdown
# Première Services — Research brief for Quebec counsel
## Executive summary (10 bullets max)
## Findings by mission (A–F)
### Finding
### Citations (title + URL + date accessed)
### Product gap it maps to (from PART 1)
### Lawyer decision needed
## Documents to draft (checklist)
## Open questions Perplexity could not verify
## Suggested first meeting agenda with counsel (30 min)
```

---

# PART 4 — IS IT A GOOD IDEA TO USE MULTIPLE AIs?

**Yes — with a clear division of labour.** Different models catch different mistakes; none replace a lawyer.

| AI | Use for | Weak at |
|----|---------|---------|
| **Cursor / coding agent** | Implement product, migrations, UI, Square wiring | Authoritative law; can invent legal certainty |
| **Claude** | Structure long briefs, cluster risks, draft lawyer memos from your questionnaire | Live web citations unless connected; may soft-hallucinate statutes |
| **Perplexity** | **Cited** research on Law 25, Square docs, CPA, OPC/CAI | Deep product nuance unless you paste PART 1; may over-weight blogs |
| **ChatGPT / Gemini** | Alternate draft of Terms/Privacy outline; second opinion on clarity | Same: not counsel; don’t paste secrets |

### Good multi-AI workflow

1. **One source of truth** = these `docs/` files + live site/Terms. Update the docs when the product changes (as with cancel fees / paid search).  
2. **Perplexity** → cited research briefs (Missions A–F).  
3. **Claude** → merge Perplexity citations + exhaustive questionnaire into a prioritized lawyer memo.  
4. **Human Quebec lawyer** → only person who “decides.”  
5. **Cursor** → implement what counsel/product decide (Privacy page, acceptance logging, Square refunds, etc.).

### Rules so multiple AIs don’t hurt you

- Don’t paste **secrets or real ID photos** into any AI.  
- Don’t treat agreement between two AIs as “legal clearance.”  
- When answers conflict, prefer **primary sources + counsel**, not majority vote.  
- Keep production support AI on a **closed knowledge pack** (no live Perplexity grounding on the public Help bot).  
- Batch legal research; don’t re-ask the same question across five tools every day — you’ll get contradictory drift.

**Bottom line:** Using Claude + Perplexity (+ coding AI) is a **good idea** for speed and coverage. Using them *instead of* a lawyer for ID, payments, and Law 25 is a **bad idea**.

---

# PART 5 — SHORT PROMPT YOU CAN COPY INTO PERPLEXITY

```
You are researching Canadian/Quebec legal and compliance topics for Première Services
(https://www.premiereservices.ca), a bilingual home-services marketplace using Square,
Supabase, government ID verification for bookings, paid pro plans, and per-service
cancellation fees (free / fixed $ or % if cancel under 24h / no cancel).

PRODUCT FACTS (ground truth — do not invent features):
[PASTE PART 1 HERE]

TASK: Complete Research Mission [A/B/C/D/E/F] from my handoff.
Cite primary sources. Prefer government and Square official docs.
Flag uncertainty. Output the lawyer-ready brief format.
Do not claim to be a lawyer. Do not invent Première product behavior.
```

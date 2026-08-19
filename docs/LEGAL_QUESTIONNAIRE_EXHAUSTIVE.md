# Première Services — Exhaustive Legal Questionnaire for Claude → Quebec Counsel

**How to use with Claude:** Paste the product briefing (`docs/CLAUDE_HANDOFF_AND_LEGAL_QUESTIONNAIRE.md` Part 1) + `docs/SUPPORT_AI_QA_KNOWLEDGE_PACK.md` + **this entire file**. Ask Claude to: (1) cluster questions by priority, (2) draft a lawyer briefing memo, (3) list documents/policies to draft, (4) flag insurance coverages to buy. Then send Claude’s memo + this list to a **human Quebec lawyer**. Claude is not counsel.

**Product context (updated):** Marketplace with Square payments, government ID verification, bilingual FR/EN, pro plans Starter/Growth/Pro, **paid plan required to advertise/book**, pro-set cancellation policies per service or account default (free / fixed $ or 25–50–75% if cancel under 24h / no-cancel full charge) **shown and checkbox-accepted at booking**, support AI, Quebec GST/QST invoice fields. Perplexity research companion: `docs/PERPLEXITY_HANDOFF_AND_RESEARCH.md`.

---

## 0. Meta for counsel

0.1 Under which governing law and forum should all platform contracts sit (Quebec? Canada federal? mixed)?  
0.2 What is the minimum “legal launch pack” before accepting real money and ID images?  
0.3 Recommended cadence for legal review (quarterly / on each major feature)?  
0.4 Should we engage separate counsel for privacy (Law 25), payments, and tax?  
0.5 Privilege / what not to put in AI chats when preparing for counsel?

---

## 1. Corporate entity, ownership, insurance

1.1 Best entity type and province of incorporation for Première Services?  
1.2 Shareholder agreements / founder IP assignment needed?  
1.3 Municipal business licence requirements (e.g. Montreal / Granby / elsewhere)?  
1.4 Required or strongly recommended insurance: CGL, E&O/professional liability, cyber, media, directors & officers, crime?  
1.5 Minimum coverage limits for a marketplace handling bookings + ID images + card payments?  
1.6 Does platform insurance cover pro negligence, or only platform errors?  
1.7 Should Terms require pros to carry their own liability insurance and name Première as additional insured?  
1.8 Workers’ compensation / CNESST risk if a pro claims employee status?  
1.9 Product liability if a pro’s work injures a third party?  
1.10 Cyber insurance requirements given ID image storage?  
1.11 Do we need a registered Privacy Officer contact published?  
1.12 Trade-name / trademark registration for “Première Services”?  
1.13 Domain/brand disputes strategy?  

---

## 2. Marketplace classification & intermediary liability

2.1 Are we a broker, agent, marketplace facilitator, or mere hosting intermediary?  
2.2 Can we effectively disclaim liability for pro quality, safety, and legality?  
2.3 Quebec consumer protection rules that cannot be waived against consumers?  
2.4 Liability for fraudulent pros / fake licences?  
2.5 Liability for fake client IDs?  
2.6 Duty to verify licences by trade (electrician, plumber, etc.)?  
2.7 “Verified” badge — what verification standard avoids misleading advertising?  
2.8 Duty to remove dangerous listings quickly?  
2.9 Secondary liability for off-platform cash deals we didn’t prevent?  
2.10 Anti-circumvention clauses enforceability in Quebec?  
2.11 Pre-existing client exception — how to define and prove without creating loopholes?  
2.12 Are we liable if a minor is present during a home service?  
2.13 Platform role when violence, theft, or sexual assault is alleged between parties?  
2.14 Police / warrant response policy for ID images and booking data?  

---

## 3. Terms of Service, clickwrap, updates

3.1 Are March 2026 Terms adequate given cancel policies + ID + Square + AI?  
3.2 Clickwrap vs scrollwrap — what is enforceable for booking and pro signup?  
3.3 Must we store Terms version hash, timestamp, IP, user-agent on acceptance?  
3.4 Pros: UI acceptance without DB log — legal defect?  
3.5 Separate Consumer Terms vs Professional Agreement vs Privacy vs Cookie Policy?  
3.6 Limitation of liability / caps — what Quebec allows?  
3.7 Indemnities from pros and clients — reciprocal balance?  
3.8 Class action / arbitration waivers — enforceable in Quebec?  
3.9 How to amend Terms with notice (email, in-app banner, versioning)?  
3.10 Conflict between UI cancel policy and Terms §10 vague language — which prevails?  
3.11 Should cancel policy be a schedule to Terms?  
3.12 Unconscionability risk of “no cancel / 100% charge” policies for consumers?  
3.13 Cooling-off / distance contract rules for online bookings in Quebec?  
3.14 Force majeure / pandemic / extreme weather cancellations?  
3.15 Survival clauses after account termination?  

---

## 4. Cancellation policies (product-specific — HIGH PRIORITY)

4.1 Can pros lawfully set: (a) free cancel, (b) 25/50/75% if &lt;24h, (c) no cancel / full charge?  
4.2 Must fee % be of pre-tax price, post-tax, or deposit only?  
4.3 When is the fee earned — at cancel time, or only if already paid?  
4.4 If booking is still `pending` (pro not accepted), can client cancel free regardless of policy?  
4.5 If pro declines, any client liability?  
4.6 Reschedule vs cancel — must policies distinguish?  
4.7 Is a checkbox + amber disclosure at booking enough assent?  
4.8 Should we snapshot policy text language (EN/FR) on the booking row?  
4.9 Interaction with Square capture timing (pay after accept) — collecting late fees how?  
4.10 If never paid yet, can we still claim a cancel fee? Invoice/collections issues?  
4.11 Refunds when client cancels under “free” vs “late fee” vs “no cancel”?  
4.12 Pro-initiated cancel — client remedies / platform duties?  
4.13 No-show by client or by pro — fees and evidence?  
4.14 Are percentage cancel fees “liquidated damages” or illegal penalties in Quebec?  
4.15 Consumer Protection Act rules on deposits and cancellation fees?  
4.16 Disclosure in French mandatory with equal prominence?  
4.17 Email confirmation must restate cancel policy?  
4.18 Admin override of fees — creating precedent / discrimination issues?  
4.19 Chargeback when client disputes a cancel fee — who fights it?  
4.20 Insurance: does cancel-fee revenue need separate treatment?  

---

## 5. Privacy / Law 25 / PIPEDA / cookies

5.1 Missing `/privacy` page while linked — urgency and mandatory contents?  
5.2 Law 25 accountability, policies, training, registers of processing?  
5.3 Consent vs contractual necessity for each data use?  
5.4 Cross-border transfers (Supabase region, Square, HF/Gemini/OpenAI, Resend, Twilio, Google Maps)?  
5.5 Vendor DPAs / SCCs checklist?  
5.6 Retention for ID images, bookings, payments, AI chats, claim evidence?  
5.7 Access / correction / deletion — no self-serve delete: process & SLA?  
5.8 Breach notification timelines (Quebec / federal)?  
5.9 Cookie banner localStorage-only — enough? Need CMP?  
5.10 Analytics / logs from Vercel/Supabase — disclose?  
5.11 Children’s data / 18+ enforcement UX?  
5.12 Public reviews after account deletion?  
5.13 Profiling / automated decisions (AI support, ranking, top picks)?  
5.14 Selling or sharing data with advertisers — prohibited?  
5.15 Employee/admin access controls to ID images?  
5.16 Privacy impact assessment required for ID verification feature?  

---

## 6. Government ID & sensitive identity data

6.1 Legality of collecting government ID images for marketplace bookings?  
6.2 Showing ID to assigned pro only — lawful basis and limits?  
6.3 How long may pro view/download ID? Must UI watermark / disable download?  
6.4 Private storage bucket enough? Encryption at rest/in transit obligations?  
6.5 Should we use a third-party KYC vendor instead of storing IDs?  
6.6 Selfie + ID for pros — biometric / sensitive data heightened duties?  
6.7 Prohibition in Terms against copying ID — enough? Need audit logs?  
6.8 Retention: delete ID after job completed + X days?  
6.9 Responding to identity theft claims?  
6.10 Quebec rules on SIN / driver’s licence / health card collection (if any appear)?  
6.11 Cross-border ID storage risk?  
6.12 Insurance for ID data breach?  

---

## 7. Payments, Square, fees, tax

7.1 Marketplace facilitator GST/QST rules — who remits what?  
7.2 Invoices showing GST/QST + “card and platform fees 5%” — compliant?  
7.3 Conflict: marketing 5% vs Square Connect ~2.1% app_fee — misleading fee disclosure risk?  
7.4 How to disclose fees in FR/EN at checkout unambiguously?  
7.5 Platform merchant of record vs Connect seller — consumer and tax consequences?  
7.6 Holding funds / escrow language vs immediate capture — fix Terms?  
7.7 Subscriptions, trials, card-on-file, $0 today — Quebec recurring payment rules?  
7.8 Plan cancel → hold — consumer notice requirements?  
7.9 Proration / upgrade/downgrade disclosures?  
7.10 Refunds “not guaranteed” — compliant?  
7.11 No automated refund API — operational legal risk?  
7.12 No payment webhooks — integrity / dispute evidence risk?  
7.13 Orphan Stripe code — remove to avoid dual-processor confusion?  
7.14 PCI scope — are we ever handling raw PAN?  
7.15 Chargebacks allocation between platform and pro?  
7.16 Pro GST/QST numbers on profile — validation duty?  
7.17 Record retention for tax (how many years)?  
7.18 T4A / Relevé / income reporting obligations for payouts to pros?  
7.19 Currency CAD only — multi-currency issues later?  
7.20 Apple Pay / Google Pay domain verification — any consumer disclosure?  

---

## 8. Advertising, French language, bilingual

8.1 Bill 96 / Charter of the French language obligations for contracts, UI, invoices, support?  
8.2 Equal quality of FR Terms vs EN?  
8.3 “Verified”, “satisfaction guarantee”, “Canada-wide expansion” — substantiation?  
8.4 Plan prices must match checkout always?  
8.5 Testimonials / review incentives disclosure?  
8.6 Comparative advertising vs competitors?  
8.7 Email/SMS marketing consent (CASL)?  
8.8 SMS booking reminders (Pro tier) — consent and opt-out?  

---

## 9. Employment / contractor / competition

9.1 Independent contractor classification risks for pros?  
9.2 Control indicators (schedules, ratings, fees, mandatory platform payment)?  
9.3 Non-solicit / non-circumvent enforceability?  
9.4 Non-compete for pros — likely unenforceable?  
9.5 Referral rewards / trials — contest or tax issues?  
9.6 Lead limits advertising without guaranteeing jobs — misleading?  

---

## 10. Content, IP, defamation

10.1 Licence to use user photos/reviews?  
10.2 Pro portfolio copyright ownership?  
10.3 Client reviews of pros and pro reviews of clients — defamation process?  
10.4 Notice-and-takedown procedure?  
10.5 Google Maps / brand guidelines compliance?  
10.6 Scraping our catalog / reverse engineering Terms?  

---

## 11. AI / automated systems

11.1 Disclosure that support is AI-assisted?  
11.2 Sending chats to HF/Gemini/OpenAI — privacy notice?  
11.3 Risk of AI inventing refund/cancel rights — liability allocation?  
11.4 Must AI answers be logged for Law 25?  
11.5 Training on Première-only pack — still need consent?  
11.6 Booking AI (Pro tier) — different disclosure?  
11.7 Automated ranking / top picks — explainability?  
11.8 Token/rate limits — consumer unfairness if support AI capped?  

---

## 12. Security & cybersecurity law

12.1 Broad RLS “Anyone can view bookings/profiles” — acceptable residual risk?  
12.2 Edge Functions with `verify_jwt: false` — which must require JWT?  
12.3 Storing Square OAuth tokens — encryption / vault requirements?  
12.4 Public buckets (job photos, evidence) — sensitive home interiors?  
12.5 Admin MFA / access logging expectations?  
12.6 Penetration testing / SOC2 expectations for Square marketplace?  
12.7 Incident response plan contents?  
12.8 Password policy inconsistency (signup 6 vs reset 8)?  

---

## 13. Disputes, claims, enforcement

13.1 Is `booking_claim_requests` process enough? Need SLA?  
13.2 Mediation obligation before courts?  
13.3 Small claims typical scenarios — platform as defendant?  
13.4 Evidence retention after claim closed?  
13.5 Publishing bans / “bad actor” lists — defamation risk?  
13.6 Law enforcement emergency disclosure without warrant?  

---

## 14. Accessibility & human rights

14.1 Web accessibility (AODA / Quebec standards) obligations?  
14.2 Discrimination by pros (refuse clients) — platform duty?  
14.3 Disability accommodations for booking UX?  

---

## 15. Minors, vulnerable persons, home safety

15.1 18+ only — enough? Age gate UX?  
15.2 Services in homes with children — guidance in Terms?  
15.3 Vulnerable seniors — extra duties?  
15.4 Weapons / illegal services on platform — prohibited categories list?  

---

## 16. Operational gaps (map to legal risk)

16.1 No Privacy Policy page live.  
16.2 No recorded Terms acceptance for pros.  
16.3 No self-serve account deletion.  
16.4 No automated refunds.  
16.5 No in-app chat (comms via email/SMS/quotes) — risk tradeoffs?  
16.6 Phone collected; Twilio verify unused.  
16.7 Paid-plan search gate is app-side best-effort (not hard RLS) — loophole if someone deep-links?  
16.8 Cancel fee collection mechanics if unpaid booking cancelled late?  

---

## 17. Insurance & financial coverage matrix (ask counsel + broker)

17.1 Cyber liability — ID breach.  
17.2 Media / advertising injury.  
17.3 Technology E&O — marketplace software errors.  
17.4 Crime / social engineering.  
17.5 Commercial general liability.  
17.6 Hired/non-owned auto if relevant.  
17.7 Directors & officers.  
17.8 Whether cancel-fee disputes are covered.  
17.9 Whether Square disputes leave platform uninsured.  
17.10 Certificates of insurance from pros — collect or not?  

---

## 18. Loopholes & abuse scenarios (stress-test)

18.1 Client books, cancels 23h before under 75% policy, disputes card.  
18.2 Pro sets “no cancel”, never shows up — client remedies.  
18.3 Pro on hold still reachable via old shared link — booking blocked in UI but data visible?  
18.4 Pro labels new Première lead as “pre-existing” to dodge 5%.  
18.5 Client uploads someone else’s ID.  
18.6 Pro downloads client ID and keeps it.  
18.7 Fake reviews / review bombing.  
18.8 Multi-account to abuse free trials / referral codes.  
18.9 Using support AI to extract internal policies not published.  
18.10 Scraping competitor data into profiles.  
18.11 Offering illegal services via vague category.  
18.12 Underage user with parent’s card.  
18.13 Admin account misuse.  
18.14 Square Connect disconnected mid-job.  
18.15 Currency/tax mis-display on invoice snapshot.  
18.16 FR user receives EN-only cancel disclosure — binding?  
18.17 Policy changed by pro after booking snapshot — which applies?  
18.18 Deep-link to unpaid pro profile still shows phone/website?  
18.19 Public job-request photos reveal home address.  
18.20 Claim evidence bucket public — sensitive docs leaked.  

---

## 19. Expansion & future features

19.1 Other provinces — extra statutes?  
19.2 US clients/pros — extra compliance?  
19.3 In-app chat — privacy/retention redesign?  
19.4 Tutorial video page — accessibility captions required?  
19.5 Background-check integration — consent forms?  
19.6 Escrow / hold funds — money services business licensing?  

---

## 20. Deliverables to request from counsel

20.1 Updated Terms of Service (consumer).  
20.2 Professional Service Provider Agreement.  
20.3 Privacy Policy (Law 25 ready).  
20.4 Cookie / tracking policy.  
20.5 Cancellation policy legal template for pros (with mandatory disclosures).  
20.6 ID verification & data processing addendum.  
20.7 Incident response / breach playbook.  
20.8 Law enforcement request policy.  
20.9 Insurance coverage recommendation letter.  
20.10 Checklist for launch in Quebec.  
20.11 French-language compliance memo (Bill 96).  
20.12 Tax/marketplace facilitator memo (GST/QST).  
20.13 Contractor classification memo.  
20.14 Review of current codebase gaps vs recommended controls.  

---

## 21. Questions to answer yourself before the lawyer meeting

21.1 Exact cities live today?  
21.2 Who is the contracting entity and address?  
21.3 Where is Supabase region hosted?  
21.4 Do you store ID after job ends? How long today?  
21.5 Who are platform admins (emails)?  
21.6 Square account entity name matching legal entity?  
21.7 Will cancel fees be auto-charged or manual invoiced?  
21.8 Preferred refund SLA?  
21.9 Any existing complaints/incidents?  
21.10 Budget for insurance and counsel?

---

**End of questionnaire.** Keep this file with `CLAUDE_HANDOFF_AND_LEGAL_QUESTIONNAIRE.md` and `SUPPORT_AI_QA_KNOWLEDGE_PACK.md` when briefing Claude and your lawyer.

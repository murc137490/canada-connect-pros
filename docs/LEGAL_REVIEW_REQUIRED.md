# LEGAL_REVIEW_REQUIRED — Première Services

Technical/content remediation may be implemented in code without counsel approval.
Items below **must not** be treated as closed until a qualified Quebec lawyer (and where noted, privacy officer / accountant / insurance broker) confirms.

| ID | Topic | Question / action for counsel |
|----|--------|-------------------------------|
| LR-001 | Legal entity | Confirm registered `LEGAL_ENTITY_NAME` and how it appears on contracts/invoices. |
| LR-002 | Privacy contact | Confirm Privacy Officer / contact name, title, and published email (Law 25). |
| LR-003 | Privacy Policy | Review draft `/privacy` FR/EN for Law 25 / PIPEDA adequacy. |
| LR-004 | Cookie Policy | Review cookie categories and consent UX under Quebec private-sector privacy rules. |
| LR-005 | Service resolution | Approve whether any “guarantee” / claims remedies are contractual rights vs discretionary help. |
| LR-006 | Limitation of liability | Confirm intermediary vs responsibility wording; consequential damages; insurance interplay. |
| LR-007 | Government ID | Confirm retention, pro visibility (status-only vs image), biometric/KYC vendor triggers. |
| LR-008 | Cancellation fees | Confirm enforceability of free / late-fee / no-cancel structures under Quebec consumer law. |
| LR-009 | Platform fee disclosure | Confirm customer/pro disclosure of 5% platform fee vs Square Connect `app_fee` internals. |
| LR-010 | Payment characterization | Confirm Square Connect flow is **not** to be called “escrow” unless architecture qualifies. |
| LR-011 | Terms acceptance | Confirm clickwrap/scrollwrap + logged version/hash/language is sufficient. |
| LR-012 | French-first | Confirm Bill 96 / Charter of the French Language obligations for contracts & UI. |
| LR-013 | Account deletion | Confirm retention of financial/tax/audit records vs erasure rights. |
| LR-014 | Incident notification | Confirm when privacy incidents require CAI/OPC or user notification. |
| LR-015 | Marketing claims | Confirm any remaining “verified / licensed / insured” language. |
| LR-016 | Separate contracts | Draft/finalize CLIENT TERMS, PROFESSIONAL AGREEMENT, WEBSITE TERMS as distinct counsel-approved docs. |
| LR-017 | Claims refund automation | Approve when Square partial/full refunds may be issued from claims. |
| LR-018 | Cross-border processors | Review DPAs / transfers for Supabase, Square, Resend, Twilio, Google, HF/AI. |

**Rule for engineers:** Prefer configurable flags + conservative public copy over inventing legal conclusions.

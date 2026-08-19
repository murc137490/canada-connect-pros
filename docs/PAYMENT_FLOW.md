# PAYMENT_FLOW — Première Services (as implemented)

**Status:** Technical description of current code.  
**LEGAL_REVIEW_REQUIRED (LR-010):** Final legal characterization (marketplace facilitator, payment agent, escrow, etc.) requires Quebec counsel. **Do not call this escrow** unless counsel confirms.

## Booking payment (service)

```
Customer (authenticated)
  → Frontend Square Web Payments SDK (card nonce)
  → Edge Function `square-create-payment`
       ├─ If pro has Square Connect tokens + location_id:
       │     Charge on **pro’s Square seller account**
       │     + `app_fee_money` ≈ PLATFORM share (code default 2.1% of service subtotal)
       │     Settlement to pro per Square; platform receives application fee per Square
       └─ Else (legacy):
             Charge on **platform Square merchant** credentials
             (no `app_fee_money` in this path)
  → Booking / invoice snapshot updated with payment metadata
```

Typical product timing: payment often occurs **after the professional accepts** the booking (not always at “Book”).

## Customer-facing fee line

- Invoice UI uses a **5%** line on the service subtotal labeled as platform/card processing fee (`PLATFORM_FEE_RATE` / `BOOKING_INVOICE_PROCESSING_FEE_RATE`).
- This **5% is the business model fee shown to users**.
- Internal split between Square processing vs Première application fee is an **implementation detail**; do not publish “Square takes 2.9%” unless verified against the live Square account.

## Pro subscriptions

- Separate Square checkout Edge Functions (`pro-plan-checkout`, trials) on platform credentials.

## Refunds

- Terms: case-by-case; **not automatic**.
- No fully automated Square Refunds API path for claims/cancellations was wired as of this remediation.
- Claims workflow records requested resolutions; admins decide; counsel must approve automation (LR-017).

## What we removed / avoid saying

- “Escrow”
- “Première holds funds until completion” (unless a future architecture truly does)
- Automatic full refunds for subjective dissatisfaction

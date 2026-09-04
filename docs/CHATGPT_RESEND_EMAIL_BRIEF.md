# ChatGPT brief — Premiere Services × Resend emails

**Copy everything below the line into ChatGPT.**

---

You are designing production HTML emails for **Resend** (not Supabase Auth UI, not Mailchimp, not a newsletter builder).

Brand: **Premiere Services** / **Première Services** — Canadian home-services marketplace.  
Live site: https://www.premiereservices.ca  

**Final visual test (must pass):**  
“Would this email look credible coming from a premium Canadian marketplace I’d trust with a booking and payment?”  
Answer must be an immediate **YES**.

Feel: **premium, calm, trustworthy, distinctly Premiere Services, intentionally designed.**  
Must NOT feel: generic, corporate, cheap, overly technical, like a Supabase email, like a Resend demo template, or like a generic SaaS notification.

Inspiration level only: Wealthsimple-style refinement (whitespace, typography, restraint).  
**Do NOT copy Wealthsimple’s colors, logo, or layouts.** Stay Premiere.

Do not add decoration for decoration’s sake. Every element must improve hierarchy, trust, usability, or brand recognition. Goal = **better design**, not more design.

---

## Product context (so copy matches the platform)

Premiere Services connects customers with verified local professionals for home and related services (cleaning, outdoor, wellness, tech, events, lessons, pets, automotive, business, etc.).

**Audiences:**
1. **Customers** — book pros, pay via Square, confirmations, reminders, sign-in / password reset, support.
2. **Professionals (pros)** — bookings, schedule, plans (Starter / Growth / Pro), referrals, Square payouts.

**Words to use:** Première / Premiere Services · booking (not appointment/order) · professional / pro (not vendor) · dashboard · quote / booking request · sign in · reset password · accept invitation.

**Tone:** calm, confident, human. Short sentences. EN first; FR when asked (Canada / Quebec-aware). No startup hype, no emoji, no fake “verified secure” badges.

**Contact (footer / help):**  
- support@premiereservices.ca  
- Phone: +1 450 910 1400 (Mon–Fri, 8am–8pm EST)  
- Terms: https://www.premiereservices.ca/terms  
- Privacy: https://www.premiereservices.ca/privacy  

**From / reply (Resend):** typically `no-reply@premiereservices.ca` or `support@premiereservices.ca`, reply-to `support@premiereservices.ca`.

---

## Visual system (match the live website)

### Colors (exact)

| Role | Hex |
|------|-----|
| Page background (outer) | `#F8F6F3` warm stone |
| Letter / content surface | `#FFFFFF` |
| Primary navy (CTA + accents) | `#102556` |
| CTA text | `#FBF9F6` |
| Body ink | `#141A24` |
| Muted body | `#5E6672` |
| Footer muted | `#8A9099` |
| Border | `#E0DAD2` |
| Detail panel fill | `#F3F0EB` |
| Maple accent (rare only) | `#E86B0C` |

### Typography
- Body / UI / CTA: `'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
- Wordmark only: `'Instrument Serif', Georgia, 'Times New Roman', serif`
- Optional Google Fonts `@import` in `<style>`; always keep fallbacks for Outlook.

### Required layout shell (Resend-safe)
1. Outer full-width background `#F8F6F3`
2. Centered **~600px** white **letter panel**: `border: 1px solid #E0DAD2`, `border-radius: 12px`, padding ~40px
3. Inside panel, in order:
   - **Wordmark:** “Première” (Instrument Serif ~28px) + “SERVICES” (Manrope 10px, uppercase, letter-spacing ~0.16em, muted)
   - Thin **40×2px navy** rule under wordmark
   - Small **eyebrow** in navy uppercase (e.g. Sign in / Booking / Confirmed)
   - **Headline** Manrope ~28px, bold, tight tracking
   - Short body copy
   - Primary **navy button** (padding ~15×28, radius 8px, cream text)
   - Optional detail panel for booking facts
   - One calm secondary note if needed (expiry / ignore if not you)
   - “Need help?” + support@ link
4. **Footer outside** the white panel (on stone bg): quiet Première Services wordmark, support · Terms · Privacy, “Canada”

### Booking detail panel
- Soft `#F3F0EB` fill
- Thin **3px navy left rail**
- Label / value rows, hairline borders between rows (not last)
- Not rainbow “status cards” (no loud green/blue/pink boxes)

### Technical (Resend)
- Tables + **inline styles**
- No JavaScript
- Unique preheader text (hidden div)
- Mobile-friendly (~16px body)
- `{{variable}}` placeholders for Resend / our API (not Supabase `{{ .ConfirmationURL }}` Go syntax)

### Avoid
- Black Slack-style CTAs as brand
- Purple gradients / Inter-as-brand
- Giant generic “SaaS card” that could be any startup
- “Hi {{name}}, sign in securely.” energy with no brand correlation
- Extra chips, badges, shadows stacks, emoji

---

## Canonical Resend variables (use ONLY these — do not invent others)

| Variable | Purpose | Used in |
| ----------------------- | ---------------------------- | ------------------------------------------------ |
| `{{name}}` | Customer's first/name | Cancellation, confirmation, request, auth emails |
| `{{magic_link_url}}` | Secure sign-in link | Magic link |
| `{{reset_url}}` | Password reset link | Password reset |
| `{{confirmation_url}}` | Email confirmation link | Confirm email |
| `{{booking_id}}` | Booking identifier | Customer + internal booking emails |
| `{{client_name}}` | Customer/client name | Internal new booking |
| `{{client_email}}` | Customer email | Internal new booking |
| `{{client_phone}}` | Customer phone | Internal new booking |
| `{{pro_name}}` | Professional's name | Booking emails |
| `{{service_type}}` | Service being booked | Booking emails |
| `{{booking_date}}` | Booking date | Booking emails |
| `{{booking_time}}` | Booking time | Booking emails |
| `{{timezone}}` | Booking timezone | Booking/internal emails |
| `{{booking_location}}` | Service location | Booking emails |
| `{{booking_status}}` | Current booking status | Internal booking |
| `{{payment_status}}` | Current payment status | Internal booking |
| `{{amount_paid}}` | Amount paid | Booking confirmation |
| `{{admin_booking_url}}` | Admin dashboard booking URL | Internal new booking |
| `{{ticket_id}}` | Support request/reference ID | Support received |
| `{{message}}` | Customer's support message | Support received |
| `{{sender_name}}` | Person sending referral | Referral invitation |
| `{{signup_url}}` | Referral/signup link | Referral invitation |
| `{{manage_booking_url}}` | Customer dashboard booking CTA | Customer booking emails |
| `{{cancellation_reason}}` | Why booking was cancelled | Booking cancelled |
| `{{subject}}` | Support ticket subject | Support received |
| `{{submitted_date}}` | When support was submitted | Support received |
| `{{expires_in}}` | Auth link lifetime (e.g. “1 hour”) | Magic link, reset, confirm |
| `{{email}}` | Account email on reset | Password reset |
| `{{reminder_window}}` | “today” / “tomorrow” / “soon” | Booking reminder headline |

Hardcoded links allowed (not variables):  
- Terms https://www.premiereservices.ca/terms  
- Privacy https://www.premiereservices.ca/privacy  
- Support mailto: support@premiereservices.ca  

**These extra vars are filled automatically by our send pipeline** when emailing via the app — put them in the HTML as `{{manage_booking_url}}` etc. Do not invent alternate names.

---

## Emails to produce (HTML for Resend)

For each: **subject**, **preheader**, full **HTML**. EN first; FR optional. Use only the variables above.

### Auth
1. **Magic link** — `{{name}}`, `{{magic_link_url}}`, `{{expires_in}}` — CTA → `{{magic_link_url}}` “Sign in securely”
2. **Password reset** — `{{name}}`, `{{email}}`, `{{reset_url}}`, `{{expires_in}}` — CTA → `{{reset_url}}` “Reset password”
3. **Confirm email** — `{{name}}`, `{{confirmation_url}}`, `{{expires_in}}` — CTA → `{{confirmation_url}}` “Confirm email”

### Customer booking
4. **Booking request received** — `{{name}}`, `{{booking_id}}`, `{{service_type}}`, `{{booking_date}}`, `{{booking_time}}`, `{{timezone}}`, `{{booking_location}}`, `{{pro_name}}`, `{{manage_booking_url}}`
5. **Booking confirmed** — same + `{{amount_paid}}`
6. **Booking reminder** — `{{name}}`, `{{reminder_window}}`, `{{booking_id}}`, `{{service_type}}`, `{{booking_date}}`, `{{booking_time}}`, `{{timezone}}`, `{{booking_location}}`, `{{pro_name}}`, `{{manage_booking_url}}` — title like “Coming up {{reminder_window}}, {{name}}”
7. **Booking cancelled** — `{{name}}`, `{{booking_id}}`, `{{service_type}}`, `{{booking_date}}`, `{{booking_time}}`, `{{timezone}}`, `{{booking_location}}`, `{{pro_name}}`, `{{cancellation_reason}}`, `{{manage_booking_url}}`

Customer booking CTAs → `{{manage_booking_url}}`.

### Other
8. **Support received** — `{{name}}`, `{{ticket_id}}`, `{{subject}}`, `{{submitted_date}}`, `{{message}}`
9. **Referral invitation** — `{{sender_name}}`, `{{signup_url}}` — CTA → `{{signup_url}}` “Accept invitation”
10. **Internal: new booking** — `{{booking_id}}`, `{{client_name}}`, `{{client_email}}`, `{{client_phone}}`, `{{pro_name}}`, `{{service_type}}`, `{{booking_date}}`, `{{booking_time}}`, `{{timezone}}`, `{{booking_location}}`, `{{booking_status}}`, `{{payment_status}}`, `{{admin_booking_url}}` — CTA → `{{admin_booking_url}}`

---

## Deliverables order
Start with magic-link + password-reset, then booking confirmed + reminder, all sharing the **same shell** so the suite feels one brand.

When done, briefly explain (2–3 bullets) how the design maps to Premiere (navy, warm stone, Première wordmark, marketplace trust) — without treating Wealthsimple as a visual clone.

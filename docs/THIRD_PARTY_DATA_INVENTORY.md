# Third-party data inventory (developer / admin)

Not a DPA. **LEGAL_REVIEW_REQUIRED (LR-018)** for transfers and agreements.

| Provider | Purpose | Data typically involved | Sensitive? | Region (typical) | DPA / agreement status |
|----------|---------|-------------------------|------------|------------------|------------------------|
| Supabase | Auth, DB, Storage, Edge | Accounts, bookings, IDs, photos, claims | Yes (IDs, addresses) | REVIEW_REQUIRED (project region) | REVIEW_REQUIRED |
| Square | Payments, Connect, subscriptions | Payment tokens, amounts, seller data | Yes (payment) | US / Square regions | REVIEW_REQUIRED |
| Resend | Transactional email | Email, booking notify content | Medium | REVIEW_REQUIRED | REVIEW_REQUIRED |
| Twilio | SMS / verify | Phone, message content | Medium | REVIEW_REQUIRED | REVIEW_REQUIRED |
| Google | Maps, Places, Geocoding | Addresses, postal, coords | Medium | REVIEW_REQUIRED | REVIEW_REQUIRED |
| Hugging Face | Support AI (`ai-chat-hf`) | Chat text, language; session JWT used server-side only | Medium (chat) | REVIEW_REQUIRED | REVIEW_REQUIRED |
| Vercel / hosting | Web app | Logs, IPs | Medium | REVIEW_REQUIRED | REVIEW_REQUIRED |
| Future KYC vendor | Identity | ID images | **High** | — | Do not enable biometrics without LR-007 |

## AI minimization rule

Do **not** send to AI providers: government ID images, card numbers, passwords, Square tokens, full address dumps, or other users’ PII beyond what the user typed in the support chat.

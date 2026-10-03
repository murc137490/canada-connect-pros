# AltShift Front Desk (GPT-Live / OpenAI Realtime)

Voice booking + support for **Les Services AltShift Inc.**
Web demo: `/front-desk` · Phone: `+1 450 800 3177`

## Architecture

```
Caller ──Telnyx SIP TLS/SRTP──► OpenAI GPT-Live (sip.api.openai.com)
                                      │ live.transport.incoming
                                      ▼
                           openai-live-sip-webhook (accept + sideband)
                                      │ tools
                                      ▼
                              front-desk-tools → Supabase / Square / Telnyx

Browser mic (/front-desk) ──WebRTC──► OpenAI gpt-realtime → front-desk-tools
```

**Phone GPT-Live path:** Telnyx FQDN SIP → `sip.api.openai.com` → OpenAI webhook `openai-live-sip-webhook` accepts the session.
Web demo remains `/front-desk` (WebRTC). Legacy Call Control IVR (`telnyx-voice-webhook`) is unused while the number is on the SIP connection.

## Phone SIP checklist

1. Telnyx SIP connection: FQDN `sip.api.openai.com:5061`, TLS, SRTP Mandatory, outbound voice profile.
2. Number voice settings: connection = that SIP trunk; **Translated Number** = OpenAI `proj_…`.
3. Deploy Edge Function `openai-live-sip-webhook` (`verify_jwt = false`).
4. OpenAI → Project → **Webhooks** → endpoint
   `https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/openai-live-sip-webhook`
   Subscribe to **`live.transport.incoming`**. Copy signing secret → Supabase secret `OPENAI_WEBHOOK_SECRET`.
5. Apply the front-desk and Member ID database migrations before deploying the Edge Functions.
6. Secrets: `OPENAI_API_KEY` (same project as `proj_`), `OPENAI_WEBHOOK_SECRET`, `TELNYX_API_KEY`, and `TELNYX_VERIFY_PROFILE_ID`; optional `OPENAI_RESPONSES_MODEL`.

## Secrets (Edge Functions)

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | GPT-Live / Realtime (never expose to browser) |
| `OPENAI_WEBHOOK_SECRET` | Verify OpenAI `live.transport.incoming` signatures (`whsec_…`) |
| `OPENAI_RESPONSES_MODEL` | Optional backend model for phone tools (default `gpt-4.1`) |
| `FRONT_DESK_SECRET` | Optional shared secret for server-side tool calls |
| `FRONT_DESK_PUBLIC_DEMO` | `1` = allow demo tool calls without login |
| `FRONT_DESK_DEMO_OTP` | `1` = accept OTP `000000` when Telnyx Verify unavailable |
| `FRONT_DESK_DEMO_CARD_LAST4` | e.g. `4821` to simulate saved card |
| `TELNYX_API_KEY` / `TELNYX_VERIFY_PROFILE_ID` | OTP SMS |
| Existing Telnyx SMS / Square secrets | Confirmations & charges |

## IDs

| Kind | Format | Where |
| --- | --- | --- |
| Customer Member ID | **4–5 digits** | `profiles.public_user_number` (display identifier; not an authentication secret) |
| Pro Member ID | **4 digits** | `pro_profiles.pro_member_id` |
| Booking ID (“Service ID” on phone) | **Letter + 5 digits** e.g. `A12345` | `bookings.public_booking_code` (new). Legacy 8-digit still valid. |

## Tools (backend decides; model only talks)

`authenticate_member`, `get_customer`, `search_services`, `get_service`, `get_availability`, `get_booking`, `get_booking_details`, `create_booking`, `confirm_terms`, `get_payment_method`, `create_payment_request`, `charge_saved_payment_method`, `create_support_ticket`, `create_complaint`, `create_feedback`, `create_feature_request`, `send_confirmation`, `escalate_to_admin`, `close_session`

No `web_search`. Off-topic → refuse politely.

Phone account lookup uses the calling number as a hint only. If exactly one account matches, the caller confirms the first name and proves access with the keypad PIN; if no PIN exists, SMS OTP is sent to the stored phone and the caller can establish a PIN. Multiple matching accounts require the Member ID flow. Five failed PIN attempts temporarily lock PIN verification for 30 minutes. The Telnyx Verify function accepts only internal server requests.

## Post-booking pro chatbot (separate)

Dashboard booking thread uses Gemini/`ai-chat-hf` with **that pro’s profile + services only** — not general knowledge.

---

## Questions you can answer to shape what the AI says

Reply to these (EN/FR) and we bake them into `FRONT_DESK_INSTRUCTIONS`:

1. **Greeting** — Exact welcome after “Welcome to Alt Shift”? Any legal line?
2. **Language** — Always ask EN/FR first, or detect from speech?
3. **A/B wording** — Prefer “Press 1 / Press 2” only, or also “say book / say existing”?
4. **Member ID prompt** — Phone caller ID identifies a possible account; SMS OTP plus the telephone keypad PIN authenticates the caller. The customer Member ID is 4–5 digits.
5. **OTP line** — The code is entered with the telephone keypad; never ask the caller to say the digits aloud.
6. **Off-topic refusal** — Keep the Alt Shift–only sentence, or customize?
7. **Terms short script** — Approve the cancellation/terms spoken summary, or paste your exact words?
8. **Price speaking** — Always “including applicable taxes” + never invent numbers (already enforced via tools)?
9. **No card** — Keep reserve + “complete payment in your Alt Shift account”?
10. **Saved card** — Exact ask: “I have a payment method ending in {last4}. Would you like to use that?”
11. **Charge confirm** — Exact: “The total is $X including applicable taxes. Would you like me to charge that payment method?”
12. **Escalation** — When to offer human / admin ticket vs keep trying?
13. **Closing** — Goodbye script after booking / after hang-up intent?
14. **Voice** — Prefer OpenAI voice `marin` / `cedar` / other?
15. **Hours** — Quiet hours when Front Desk should say “we’re closed”?
16. **Brand** — Always “Alt Shift” vs “AltShift” vs “Les Services AltShift Inc.”?

Customer Member IDs are **4–5 digits** and are identifiers only. OTP and keypad PIN provide caller authentication. Pros keep a separate **4-digit** `pro_member_id`.

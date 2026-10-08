# AltShift Front Desk (phone + web voice, OpenAI Realtime)

Voice support for **Les Services AltShift Inc.** — « Les services, autrement ».
Phone: `+1 450 800 3177` · Web demo: `/front-desk`

## Call path (phone)

```
Caller dials +1 450 800 3177 (Telnyx number)
   │  Telnyx TeXML app fetches instructions
   ▼
telnyx-texml-openai  ──►  <Dial answerOnBridge> sip:proj_…@sip.api.openai.com (TLS + SRTP)
   │                       (caller keeps hearing ringback until the AI answers;
   │                        if the SIP leg fails, Dial action ?stage=after_dial plays a short FR/EN apology)
   ▼
OpenAI Realtime SIP  ──webhook realtime.call.incoming──►  openai-live-sip-webhook
   │  1. (optional) verifies the Standard Webhooks signature
   │  2. creates front_desk_sessions row (channel phone, caller number kept server-side)
   │  3. POST /v1/realtime/calls/{call_id}/accept  (model gpt-realtime, voice marin, G.711 µ-law,
   │     near-field noise reduction, server VAD, tools)   — falls back to the previous audio config on 400/422,
   │     rejects with SIP 480 if accept keeps failing
   │  4. opens the sideband WebSocket wss://api.openai.com/v1/realtime?call_id=…
   ▼
Sideband (same function): greeting, keypad (DTMF), tools → front-desk-tools (service role),
fillers, silence handling, hand-off/callback, hang-up, relay to a fresh worker before the Edge wall-clock limit.
```

Web: `/front-desk` → `front-desk-session` mints an ephemeral client secret (`/v1/realtime/client_secrets`) →
browser WebRTC to `/v1/realtime/calls` → tool calls relayed by `src/lib/frontDesk/realtimeClient.ts` to `front-desk-tools`.
Web sessions can never be phone sessions, so the voice-PIN tools are phone-only.

`telnyx-voice-webhook` is the old Call Control IVR; it is unused while the number points at the TeXML app.

## Conversation behaviour (phone)

| Topic | Behaviour |
| --- | --- |
| Greeting | Spoken by the AI as soon as the sideband connects: « Bonjour, vous êtes bien chez AltShift. Comment puis-je vous aider? For English, simply speak English or press 2. » Keypad 1 = French, 2 = English during the first ~20 s. |
| Language | Detects FR/EN from speech, stays in the caller's language, natural Québec French with « vous ». |
| Tools | Model says a short filler; if it didn't, the sideband plays one after ~1.8 s, and "thank you for your patience" after ~6.5 s. Each tool call times out after 9 s (`tool_timeout`) and the model apologizes / offers a callback. |
| Silence | After the AI stops talking: ~9 s → one gentle check-in (rephrased), another ~9 s → polite goodbye and hang-up. Paused while tools run or digits are being entered. |
| Barge-in / noise | Server VAD with `interrupt_response`, threshold 0.7, 300 ms prefix, 800 ms silence; near-field noise reduction. Only one response at a time (queued), so the AI does not talk over itself. |
| Identity | Phone number = hint only. Member ID (4 digits) confirmed with keypad 1/2, then the voice PIN on the keypad (never spoken). No account info before the PIN. No SMS on the phone line. |
| Guardrails | No invented prices/availability/policies (phone booking is off by default, so no prices are quoted); never reveal other people's data; off-topic and abuse handled politely; emergencies → "hang up and call 9-1-1". |
| Hand-off | `transfer_to_human`: live SIP REFER if `FRONT_DESK_HUMAN_TRANSFER_URI` is set, otherwise a callback ticket. `request_callback` files a `front_desk_tickets` row (kind `escalation`, subject `callback_request`, max 3 per call). Offered on request, after 2 failed attempts, or when stuck. |
| Ending | `end_call` hangs up after the goodbye finishes playing; the session row gets `closed_at`. |
| Resilience | Timeouts on every external fetch; sideband reconnect (2 tries) on unexpected drops; relay to a fresh worker ~115–135 s into each worker (Edge wall clock); logs contain no phone numbers, PINs or secrets. |

## Secrets / env (Edge Functions)

| Name | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Realtime (never exposed to the browser) |
| `OPENAI_WEBHOOK_SECRET` | `whsec_…` signing secret of the OpenAI project webhook |
| `OPENAI_WEBHOOK_SIGNATURE_MODE` | `log` (default: verify and log only), `enforce` (reject bad signatures), `off` |
| `FRONT_DESK_SECRET` | Optional shared secret for server-side tool calls |
| `FRONT_DESK_HUMAN_TRANSFER_URI` | Optional `tel:+1…` / `sip:…` target for live transfer |
| `FRONT_DESK_PHONE_BOOKING` | `1` = allow prices/availability/booking tools on the phone (off by default; the catalogue is still a demo) |
| `FRONT_DESK_REALTIME_MODEL`, `FRONT_DESK_VOICE` | Override model (`gpt-realtime`) / voice (`marin`) |
| `FRONT_DESK_TURN_DETECTION` | `semantic` to try semantic VAD (default server VAD) |
| `FRONT_DESK_VAD_THRESHOLD`, `FRONT_DESK_VAD_SILENCE_MS`, `FRONT_DESK_VOICE_SPEED` | Audio tuning (defaults 0.7, 800, 0.95) |
| `FRONT_DESK_SILENCE_MS`, `FRONT_DESK_TOOL_TIMEOUT_MS`, `FRONT_DESK_SIDEBAND_MAX_MS` | Silence check-in delay (9000), per-tool timeout (9000), per-worker sideband budget (140000; raise toward 390000 on a paid plan) |
| `FRONT_DESK_PUBLIC_DEMO`, `FRONT_DESK_DEMO_OTP`, `FRONT_DESK_DEMO_CARD_LAST4` | Web demo only |
| `OPENAI_SIP_PROJECT_ID`, `TELNYX_SMS_FROM` | TeXML dial target and caller ID (unchanged) |

## IDs

| Kind | Format | Where |
| --- | --- | --- |
| Member ID (clients and pros) | **exactly 4 digits** | `profiles.public_user_number`; `pro_profiles.pro_member_id` mirrors it |
| Booking ID | letter + 5 digits, e.g. `A12345` (legacy 8-digit still valid) | `bookings.public_booking_code` |

## Tools (backend decides; the model only talks)

Phone identity: `identify_caller` (no names before PIN), `lookup_member_id`, `clear_caller_guess`, `verify_voice_pin`, `begin_voice_pin_setup`.
Account (after PIN): `get_customer`, `get_booking`, `get_booking_details`, `create_support_ticket`, `create_complaint`, `create_feedback`, `create_feature_request`, `escalate_to_admin`, `send_confirmation`, pro tools `list_pro_bookings`, `read_pro_booking`, `check_booking_landmark`.
Catalogue: `search_services` (no prices on the phone unless `FRONT_DESK_PHONE_BOOKING=1`), `get_service`, `get_availability`, `list_demo_slots`, `confirm_terms`, `create_booking`, payment tools — all gated off on the phone by default.
Hand-off / ending: `request_callback`, `transfer_to_human`, `end_call`, `close_session`.
Web only: `authenticate_member` (SMS code). No `web_search`.

The system prompt lives in `supabase/functions/_shared/frontDeskRealtime.ts` and is copied byte-for-byte to
`supabase/functions/openai-live-sip-webhook/frontDeskRealtime.ts` (a unit test enforces this).

## Testing by phone (after deploy)

1. Call, stay silent: greeting within ~1–2 s of the AI answering, one check-in, then goodbye + hang-up.
2. Speak English first: the AI should switch to English and stay there. Press 2 at the start: same.
3. Ask for a price: no number should be invented; it should offer the website or a callback.
4. Account question: Member ID confirm (1/2) → PIN on keypad → answer. Wrong PIN twice → callback offer.
5. "I want to talk to someone": callback ticket in `front_desk_tickets` (or live transfer if configured).
6. Mention a gas smell: immediate 9-1-1 sentence.
7. Stay on the line > 2.5 minutes while using tools: the sideband relay must keep tools working.

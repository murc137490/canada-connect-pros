# AltShift — changes to test today (for Grok / QA)

**Support phone:** `+1 450 800 3177`
**Web Front Desk (GPT-Live):** `/front-desk`
**Project:** Supabase `hptzapnrnbqlptrstjxo` · brand Les Services AltShift Inc. / altshift.ca

---

## Important: phone vs GPT-Live right now

| Channel | Status |
| --- | --- |
| **Browser** `/front-desk` | Uses OpenAI Realtime / GPT-Live when `OPENAI_API_KEY` is set |
| **Phone** `+1 450 800 3177` | Still Telnyx Call Control only (welcome + press 1/2). **Not** GPT-Live yet |

Phone will stay on the simple IVR until Telnyx routes the number over **SIP to OpenAI** and we accept the call with GPT-Live (see end of this doc).

---

## 1. Telnyx / support line basics

1. Call **`+1 450-800-3177`**
2. Expect bilingual-ish welcome: “Welcome to Alt Shift…”
3. Press **1** → new service script (Member ID / Front Desk mention)
4. Press **2** → existing booking script (Booking ID like A12345)
5. Confirm Call Control webhook URL is:
   `https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/telnyx-voice-webhook`
6. Secrets expected: `TELNYX_API_KEY`, optionally verify profile for OTP

**Pass:** Call answers and speaks (not dead air).
**Fail:** Busy / no answer / old “AI being set up” only with immediate hangup and no 1/2 gather.

---

## 2. Pro-tier SMS automation (exclusive to `subscription_tier = pro`)

### Features
- SMS booking **confirmation** (client + pro) when a booking is created
- SMS **reminders** at **24 / 48 / 72 hours** before appointment (pro chooses)
- SMS **review request** after booking is `completed` and date has passed
- Custom message bodies optional; **support footer always appended**
  (`+1 450 800 3177` · support@altshift.ca · altshift.ca chat · STOP)

### Where to configure
Dashboard → Bookings / My requests → **SMS automation (Pro)** panel

### Test
1. Use a **Pro** tier pro with phone on client + pro profiles
2. Set reminder to 24h / 48h / 72h and save
3. Create a booking → expect confirmation SMS (if Telnyx SMS configured)
4. Non-Pro listing → SMS skipped (`not_pro_tier`)
5. Completed past booking → review SMS via hourly cron `booking-sms-reminders`

Deployed functions: `booking-sms-notify`, `booking-sms-reminders`

---

## 3. Post-booking AI chat (Pro only) — **per-pro bot**

- On client **My bookings** and pro booking detail
- Answers **only** about **that** pro’s profile + services + this booking
- Backend: Gemini via `ai-chat-hf` (HF fallback)
- No weather / general web answers

### Test
1. Pro-tier booking → chat visible
2. Ask “what’s included?” → answer from pro services/bio
3. Ask “what’s the weather?” → refuse / stay on-pro
4. Starter/Growth pro → chat hidden

---

## 4. Front Desk web app (GPT-Live)

- Route: **`/front-desk`**
- Mic permission, live voice, demo calendar slots, close session
- Tools: Member ID + OTP, search services, availability, create booking, terms, payment pending, tickets
- **No web search**

### Test
1. Open `/front-desk`
2. See demo slots (needs `front-desk-tools` + migration)
3. Start voice → allow mic
4. Needs secret **`OPENAI_API_KEY`** on Edge Functions
5. Optional demo: `FRONT_DESK_DEMO_OTP=1` (OTP `000000`)

---

## 5. IDs

| Kind | Format | Notes |
| --- | --- | --- |
| Customer Member ID | **4–5 digits** | `profiles.public_user_number` — display identifier; OTP authenticates |
| Pro Member ID | **4 digits** | `pro_profiles.pro_member_id` |
| Booking ID (“Service ID” on phone) | **Letter + 5 digits** e.g. `A12345` | New bookings; legacy 8-digit still valid |

### Member ID change (My account)
1. Dashboard → My account → **Member ID** segment
2. Type a taken ID → **red “taken”**
3. Type a free ID → Confirm → old ID freed
4. Pros: also 4-digit Pro Member ID editor

---

## 6. Make a request updates

1. **Step 1 (Need):** photos uploadable (not only step 2)
2. **Budget:**
   - Service min **$20**
   - Max cannot be below min (auto-clamp)
   - Live banner: taxes + **5% platform fee**
     Example: type min **20** max **50** → shows **$24 – $60** all-in
   - Saved `budget_range` uses all-in numbers for pros

### Test
- Upload image on step 1
- Type budget 20/50 → banner 24/60 without pressing Enter
- Type max &lt; min → max bumps up
- Type min 10 → on blur floors to 20

---

## 7. Secrets checklist (Supabase Edge)

| Secret | Needed for |
| --- | --- |
| `TELNYX_API_KEY` | Voice answer/speak + SMS |
| `TELNYX_SMS_FROM` | `+14508003177` |
| `TELNYX_VERIFY_PROFILE_ID` | OTP |
| `BOOKING_REMINDER_SECRET` | Reminder/review cron |
| `OPENAI_API_KEY` | `/front-desk` GPT-Live + future phone SIP |
| `FRONT_DESK_DEMO_OTP` | Optional `1` for OTP `000000` |
| `FRONT_DESK_PUBLIC_DEMO` | Optional open demo tools |

---

## 8. Deployed Edge Functions (today / recent)

- `telnyx-voice-webhook` — phone IVR (not GPT-Live yet)
- `telnyx-verify` — OTP
- `booking-sms-notify` / `booking-sms-reminders`
- `front-desk-session` / `front-desk-tools`
- `ai-chat-hf` — existing Gemini/HF for booking assistant

---

## How to put GPT-Live on the phone (fix)

**Why it fails today:** the number is attached to a **Telnyx Call Control Application** that hits `telnyx-voice-webhook`, which only does `answer` → `speak` → `gather`. Audio never reaches OpenAI.

**Correct architecture:**

```
Caller → +1 450 800 3177 (Telnyx)
              │
              │ SIP TLS + SRTP
              ▼
     sip:proj_XXXX@sip.api.openai.com
              │
              │ webhook: live.transport.incoming (or realtime.call.incoming)
              ▼
     Your backend ACCEPTS with gpt-live-1 / gpt-realtime
     + Front Desk instructions + tools
              │
              ▼
     Sideband WS → front-desk-tools (Member ID, bookings, etc.)
```

### Steps to fix
1. In **OpenAI** platform → Project → Webhooks → subscribe to Live/Realtime **incoming SIP** events → point to a new Edge Function (e.g. `openai-live-sip-webhook`).
2. Note your OpenAI **`proj_…`** Project ID.
3. In **Telnyx**: create/use a **SIP Connection / FQDN** that sends inbound calls to:
   `sip:proj_YOUR_ID@sip.api.openai.com;transport=tls`
   Enable **SRTP** (`;secure=srtp` / encrypted media). Without SRTP callers often hear silence.
4. Detach `+14508003177` from the old Call Control app (or stop using that webhook as the primary path) and attach it to the SIP connection that targets OpenAI.
5. Backend on incoming webhook must **Accept** the session with model `gpt-live-1` (or `gpt-realtime`), Front Desk instructions, and tool delegation to `front-desk-tools`.
6. Set `OPENAI_API_KEY` (same project as `proj_`).

Until steps 1–5 are done, phone will **never** use ChatGPT Live no matter what we put in `telnyx-voice-webhook`.

**Works today for GPT-Live testing:** open **`https://www.altshift.ca/front-desk`** (or local `/front-desk`) with mic + `OPENAI_API_KEY`.

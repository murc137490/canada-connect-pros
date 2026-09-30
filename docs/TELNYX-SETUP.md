# Telnyx setup (SMS + Verify + Cursor MCP)

AltShift sends booking SMS via **Telnyx** when configured (Twilio remains a fallback).
Support line: **+1 450 800 3177** (`tel:+14508003177`).

## 1. Portal checklist

1. [Telnyx Mission Control](https://portal.telnyx.com) → create/API key.
2. Messaging profile **AltShift SMS** attached to **+1 450 800 3177**.
3. Call Control Application **AltShift Support** (webhook → `telnyx-voice-webhook`).
4. Verify profile **AltShift OTP** (SMS, CA/US, 6-digit).

### Current resource IDs (Sep 2026)

| Resource | ID / value |
| --- | --- |
| Phone | `+14508003177` (`3059996860258190883`) |
| Messaging profile | `4001a0ef-d068-4e9b-9c05-3cc6a39447b6` |
| Call Control app | `3060031730896340257` |
| Verify (OTP) profile | `490001a0-efd0-69b0-00b0-e8f55033656f` |
| Voice webhook | `https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/telnyx-voice-webhook` |

## 2. Supabase Edge secrets

Dashboard → Project → Edge Functions → Secrets (or ask the Supabase AI assistant to set them):

```text
TELNYX_API_KEY=<your key>
TELNYX_SMS_FROM=+14508003177
TELNYX_VERIFY_PROFILE_ID=490001a0-efd0-69b0-00b0-e8f55033656f
BOOKING_REMINDER_SECRET=<same secret scheduled in cron booking-sms-reminders-hourly>
```

| Secret | Used by |
| --- | --- |
| `TELNYX_API_KEY` | `booking-sms-notify`, `telnyx-verify`, `telnyx-voice-webhook` |
| `TELNYX_SMS_FROM` | `booking-sms-notify` |
| `TELNYX_VERIFY_PROFILE_ID` | `telnyx-verify` |
| `BOOKING_REMINDER_SECRET` | `booking-sms-notify` (reminder), `booking-sms-reminders` |

See also `docs/TELNYX-SMS-VOICE.md`.

## 3. Deploy functions

```bash
supabase functions deploy booking-sms-notify --project-ref hptzapnrnbqlptrstjxo
supabase functions deploy telnyx-verify --project-ref hptzapnrnbqlptrstjxo
supabase functions deploy telnyx-voice-webhook --project-ref hptzapnrnbqlptrstjxo
```

`telnyx-voice-webhook` currently answers and plays a bilingual “setup in progress” greeting. Full AI support (services / booking) is a later iteration.
## 4. Cursor MCP (agent can manage Telnyx from chat)

Project file: `.cursor/mcp.json` (gitignored) — remote Telnyx MCP with Bearer header:

```json
{
  "mcpServers": {
    "telnyx": {
      "url": "https://api.telnyx.com/v2/mcp",
      "headers": {
        "Authorization": "Bearer PASTE_YOUR_TELNYX_API_KEY_HERE"
      }
    },
    "telnyx-docs": {
      "url": "https://developers.telnyx.com/mcp"
    }
  }
}
```

1. Paste your API key over `PASTE_YOUR_TELNYX_API_KEY_HERE` (keep the word `Bearer `).
2. Cursor **Settings → MCP** → reload / enable **telnyx** until it shows connected.
3. In a new chat, ask e.g. “list my Telnyx phone numbers”.

Remote endpoint: `https://api.telnyx.com/v2/mcp`  
Docs: https://developers.telnyx.com/development/mcp/remote-mcp

**Note:** MCP lets the agent manage Telnyx (numbers, profiles, etc.). A Path C voice support bot still needs a Call Control Application + public webhook Edge Function — separate from this MCP link.

## 5. API smoke tests

**Booking SMS** (Pro-tier only; confirmation needs client JWT):

```http
POST /functions/v1/booking-sms-notify
Authorization: Bearer <user-jwt>
{ "booking_id": "<uuid>", "event": "confirmation" }
```

**Verify OTP:**

```http
POST /functions/v1/telnyx-verify
{ "action": "send", "to": "+15145550123", "channel": "sms" }

POST /functions/v1/telnyx-verify
{ "action": "check", "to": "+15145550123", "code": "123456" }
```

# Telnyx setup (SMS + Verify + Cursor MCP)

AltShift sends booking SMS via **Telnyx** when configured (Twilio remains a fallback).
Support line: **+1 450 800 3177** (`tel:+14508003177`).

## 1. Portal checklist

1. [Telnyx Mission Control](https://portal.telnyx.com) → create/API key.
2. Assign **+1 450 800 3177** (or your messaging number) to a **Messaging Profile**.
3. (Optional OTP) Create a **Verify Profile** and copy its ID.

## 2. Supabase Edge secrets

Dashboard → Project → Edge Functions → Secrets (or CLI):

```bash
supabase secrets set TELNYX_API_KEY="KEY016…"
supabase secrets set TELNYX_SMS_FROM="+14508003177"
# Optional — phone OTP
supabase secrets set TELNYX_VERIFY_PROFILE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

| Secret | Used by |
| --- | --- |
| `TELNYX_API_KEY` | `booking-sms-notify`, `telnyx-verify` |
| `TELNYX_SMS_FROM` | `booking-sms-notify` (E.164 From) |
| `TELNYX_VERIFY_PROFILE_ID` | `telnyx-verify` |

Twilio secrets (`TWILIO_*`) still work as fallback if Telnyx is unset.

## 3. Deploy functions

```bash
supabase functions deploy booking-sms-notify
supabase functions deploy telnyx-verify
supabase functions deploy ai-chat-hf
```

## 4. Cursor MCP (agent can manage Telnyx from chat)

Project file: `.cursor/mcp.json` points at Telnyx’s remote MCP.

1. Cursor **Settings → MCP**
2. Open the **telnyx** server
3. Authenticate with your Telnyx API key (Bearer), or set env `TELNYX_API_KEY` for the local `npx @telnyx/mcp` server

Remote endpoint: `https://api.telnyx.com/v2/mcp`  
Docs: https://developers.telnyx.com/development/mcp/remote-mcp

After MCP is connected, you can ask the agent to list numbers, messaging profiles, send test SMS, etc.

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

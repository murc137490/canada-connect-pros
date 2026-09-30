# Telnyx SMS + voice + OTP (Dashboard / AI deploy notes)

## Already done in Telnyx + code

- Call Control app **AltShift Support** → webhook `telnyx-voice-webhook`
- Messaging profile **AltShift SMS** on `+14508003177`
- Verify profile **AltShift OTP**
- Edge Functions deployed: `telnyx-voice-webhook`, `telnyx-verify`, `booking-sms-notify` (client **and** pro), `booking-sms-reminders`
- DB column `bookings.sms_reminder_sent_at`
- Hourly cron `booking-sms-reminders-hourly` (minute 15 each hour)

## Secrets you must set once (Dashboard)

Project → **Edge Functions** → **Secrets** → add/update:

| Name | Value |
| --- | --- |
| `TELNYX_API_KEY` | your Telnyx API key |
| `TELNYX_SMS_FROM` | `+14508003177` |
| `TELNYX_VERIFY_PROFILE_ID` | `490001a0-efd0-69b0-00b0-e8f55033656f` |
| `BOOKING_REMINDER_SECRET` | same value used by the hourly cron (ask agent / check vault note — do not paste into git) |

(Ask the Supabase AI assistant: “Set these four Edge Function secrets” and paste the table.)

Without `TELNYX_API_KEY` + `TELNYX_SMS_FROM`, SMS is skipped; voice cannot answer/speak; OTP fails.

## Behaviour

| Event | Who gets SMS | When |
| --- | --- | --- |
| Booking confirmation | Client + Pro | On book (Pro-tier listings) |
| ~24h reminder | Client + Pro | Hourly cron finds appointments 23–25h ahead |

SMS only runs when the Pro’s `subscription_tier` is **`pro`**.

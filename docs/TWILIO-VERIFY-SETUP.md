# Twilio Verify Setup (SMS OTP / 2FA)

Use **Twilio Verify** for one-time codes (SMS or call) for:

- Phone verification at signup
- 2FA on login or sensitive actions
- Password reset OTP

Supabase continues to handle **authentication**, **database**, and **user accounts**. Twilio is used only for **sending and checking** the one-time code.

---

## 1. Where to find your Twilio credentials

### Account SID and Auth Token

- **Twilio Console:** [console.twilio.com](https://console.twilio.com) → **Account** (left) → **API keys & tokens** (or **Dashboard**).
- **Account SID:** e.g. `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
- **Auth Token:** click “Show” to reveal. Use this only in **Supabase Edge Function secrets**, never in the frontend.

### Verify Service SID

- **Twilio Console** → **Explore Products** → **Verify** → **Services** (or [Verify Services](https://console.twilio.com/us1/develop/verify/services)).
- Create a service if needed, then copy the **Service SID** (paste your real value here).

---

## 2. Example (test phone and code)

- **Test phone:** `+14505784500` (E.164: country code + number).
- **Send verification:** the user receives an SMS with a one-time code (e.g. `4977`).
- **Check verification:** your app sends the same `to` and the `code` the user entered to the Edge Function.

Example API usage:

**Send code (from your app or Postman):**

```http
POST /functions/v1/twilio-verify
Content-Type: application/json

{ "action": "send", "to": "+14505784500", "channel": "sms" }
```

**Check code:**

```http
POST /functions/v1/twilio-verify
Content-Type: application/json

{ "action": "check", "to": "+14505784500", "code": "4977" }
```

---

## 3. Supabase Edge Function secrets

1. **Supabase Dashboard** → your project → **Edge Functions** → **twilio-verify** → **Secrets**.
2. Add:

| Secret name | Value |
|-------------|--------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID (e.g. `AC...`) |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_VERIFY_SERVICE_SID` | Your Verify Service SID (e.g. `VA...`) |

---

## 4. Deploy the Edge Function

```bash
supabase functions deploy twilio-verify
```

Then call it from your frontend or backend with the user’s JWT in the `Authorization` header if you add auth checks.

---

## 5. Suggested flows

- **Phone verification at signup:** After signup, call `action: "send"` with the user’s phone. On your “Enter code” screen, call `action: "check"` with `to` and `code`; if `valid === true`, mark the phone as verified in your DB.
- **2FA on login:** After password check, call `action: "send"`, then on the 2FA step call `action: "check"`.
- **Password reset:** Same pattern: send code to phone (or email channel if you use Verify for email), then check the code before allowing password change.

All authentication and user records stay in Supabase; Twilio only sends and verifies the OTP.

# Email language preference (EN/FR) – setup guide

Users choose their preferred language for emails when creating an account (signup or pro registration). This doc covers the database, app behavior, and how to send localized emails (including SMTP).

---

## 1. What’s already done in the app

- **Signup (Auth page)**  
  When creating an account, users see **“Preferred language for emails”** with options **English** and **Français**. The choice is sent in signup metadata and stored in `profiles.email_language` via the trigger. This is the **only** place we ask; it applies to all emails (client and pro).

- **Create Pro Account**  
  We do **not** ask for email language again. Pro emails (registration, approval, rejection) use the language the user chose at signup, via `get_pro_and_user` (which falls back to `profiles.email_language` when `pro_profiles.email_language` is not set).

- **Database**  
  Run the SQL in **`ADD-EMAIL-LANGUAGE.sql`** once in Supabase (see below). It adds:
  - `profiles.email_language` (for all users)
  - `pro_profiles.email_language` (for pros)
  - Updated `handle_new_user()` trigger to set `profiles.email_language` from signup metadata
  - RPC `get_pro_and_user(pro_user_id)` for Edge Functions to get a pro’s email and `email_language`

---

## 2. SQL to run in Supabase

Run the contents of **`supabase/ADD-EMAIL-LANGUAGE.sql`** in the Supabase Dashboard → **SQL Editor** → New query → paste → Run.

That file:

- Adds `email_language` to `profiles` and `pro_profiles` (default `'en'`, allowed values `'en'`, `'fr'`).
- Updates `handle_new_user()` so new signups get `email_language` from `raw_user_meta_data.email_language`.
- Creates `get_pro_and_user(pro_user_id)` returning `user_id`, `email`, `business_name`, `email_language` (with fallback to `profiles.email_language` then `'en'`).

No need to alter `auth.users`; preferences are in `profiles` and `pro_profiles`.

---

## 3. Sending emails in the right language

For **app-generated emails** (e.g. pro registration received, pro approved/rejected):

1. **Get the user’s language**  
   - For a **pro**: call RPC `get_pro_and_user(pro_user_id)` and use the returned `email_language` (or default `'en'`).
   - For a **client** (no pro profile): read `profiles.email_language` for that `user_id`.

2. **Pick the template**  
   Use `email_language === 'fr'` for French subject/body, otherwise English.

3. **Send the email**  
   Use your Edge Function (or other backend) with SMTP or an email API.

Example template usage:

- **Registration (EN):** Subject: `Thanks for applying to be a Pro` | Body: `Thanks for applying to be a Pro. We will review your application shortly.`
- **Registration (FR):** Subject: `Merci d'avoir postulé pour devenir Pro` | Body: `Merci d'avoir postulé pour devenir Pro. Nous examinerons votre candidature sous peu.`
- **Approval (EN):** Subject: `Your Pro application was approved` | Body: `Congratulations — your application has been approved. Sign in to access Pro features.`
- **Approval (FR):** Subject: `Votre candidature Pro a été approuvée` | Body: `Félicitations — votre candidature a été approuvée. Connectez-vous pour accéder aux fonctionnalités Pro.`
- **Rejection (EN):** Subject: `Your Pro application was reviewed` | Body: `We reviewed your application and it was not approved. Reason: {reason}`
- **Rejection (FR):** Subject: `Votre candidature Pro a été examinée` | Body: `Nous avons examiné votre candidature et elle n'a pas été approuvée. Raison : {reason}`

---

## 4. Why SMTP user and SMTP password are needed

**They are not your Supabase admin login.** They are credentials from your **email sending provider** (e.g. AWS SES, SendGrid, Resend).

- **SMTP username** and **SMTP password** authenticate your app with that provider’s SMTP server so it can send mail on your behalf.
- You create or copy them in the **email provider’s** dashboard (e.g. AWS SES → SMTP settings, or the provider’s “API keys” / “SMTP credentials”).
- Store them as **secrets** (e.g. Supabase Edge Function secrets or env vars). Never put them in frontend code or in git.
- The “From” address must be one your provider allows (e.g. verified domain or address in SES).

**Summary:** SMTP user/pass = credentials from your **email provider** so your backend can send emails. You use them only on the server (e.g. Edge Function); they are not for “logging in as admin” to Supabase.

---

## 5. Prompt you can give Cursor AI (Edge Function / backend)

Use this so the backend sends emails in the user’s chosen language:

```
The app already stores email language preference:
- On signup: users choose "Preferred language for emails" (English or Français); it is saved in profiles.email_language via handle_new_user using raw_user_meta_data.email_language.
- On pro registration: the Create Pro Account form includes "Preferred language for emails" (en/fr) and saves it to pro_profiles.email_language.

For sending localized emails to pros:
1. Call the RPC get_pro_and_user(pro_user_id) to get email, business_name, and email_language.
2. If email_language === 'fr', use French subject and body; otherwise use English.
3. Use the templates in EMAIL-LANGUAGE-SETUP.md (registration, approval, rejection) and substitute {reason} for rejection emails.

For sending localized emails to non-pro users, read profiles.email_language for that user_id and use the same en/fr logic.

Store SMTP credentials (SMTP user and SMTP password from the email provider, e.g. AWS SES) in Supabase Edge Function secrets; do not hardcode them. Use them only in the Edge Function that sends email.
```

---

## 6. Quick reference

| Where                | What to do |
|----------------------|------------|
| **Supabase SQL**     | Run `supabase/ADD-EMAIL-LANGUAGE.sql` once. |
| **Signup**           | User selects English or Français for emails; stored in `profiles.email_language`. |
| **Create Pro**       | Pro selects English or Français; stored in `pro_profiles.email_language`. |
| **Edge Function**    | Use `get_pro_and_user(pro_user_id)` for pros; use `profiles.email_language` for others; send EN or FR template accordingly. |
| **SMTP user/pass**   | From your email provider (e.g. SES). Store in Supabase secrets; use only in the backend. |

# Premiere Services email templates

Brand-aligned transactional emails (navy `#102556`, warm stone `#F8F6F3`, white letter panel, Manrope + Instrument Serif wordmark).

**Visual bar:** credible from a premium Canadian marketplace you’d trust with a booking and payment — calm, intentional, distinctly Premiere — not a generic SaaS/Resend demo.

## App pipeline (Resend)

Source of truth for app-sent mail:

- Design system: `supabase/functions/_shared/premiereEmail.ts`
- Templates: `supabase/functions/send-app-email/index.ts`

Types include `auth_magic_link`, `auth_reset_password`, `auth_confirm_signup`, plus booking/support emails.

Deploy:

```bash
supabase functions deploy send-app-email --project-ref hptzapnrnbqlptrstjxo
```

## Supabase Auth Dashboard templates

If Auth still sends via **Dashboard → Authentication → Emails**, paste the HTML from:

| Auth email | File |
|------------|------|
| Magic Link | `magic-link.html` |
| Reset Password | `reset-password.html` |
| Confirm signup | `confirm-signup.html` |

These use Supabase Go variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.).

Subject line suggestions:

- Magic Link: `Your Premiere Services sign-in link`
- Reset Password: `Reset your Premiere Services password`
- Confirm: `Confirm your Premiere Services account`

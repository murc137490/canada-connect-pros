# Ops hardening follow-ups

This note lists production changes that must be done manually, or in a separate migration pull request. They are intentionally **not** in the front-end / hosting PR that added this file.

Do not apply them blindly against production. Review live grants and Edge Function settings first, and ship database changes through a reviewed migration.

Legal name for public copy: **Les Services AltShift Inc.** Brand: **AltShift** (`www.altshift.ca`).

## Supabase: admin RPC execute grants

Revoke `anon` (and `PUBLIC`, which Supabase `anon` can inherit) `EXECUTE` on admin `SECURITY DEFINER` functions. Confirm each function still checks the caller is a platform admin before doing any work. Then grant `EXECUTE` only to `authenticated` where the app calls them with a user JWT, or only to `service_role` if the browser must not call them at all.

Check at least:

- `accept_pro_by_admin`
- `remove_pro_by_admin`
- `grant_platform_admin_by_email`
- `moderate_job_request_admin`
- `admin_set_pro_subscription_tier`
- `platform_admin_emails`

Useful live check (read-only):

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'accept_pro_by_admin',
    'remove_pro_by_admin',
    'grant_platform_admin_by_email',
    'moderate_job_request_admin',
    'admin_set_pro_subscription_tier',
    'platform_admin_emails'
  );
```

Repo migrations often `REVOKE` from `PUBLIC` and `GRANT` to `authenticated` only. Re-check the live project anyway: Supabase default privileges can grant `EXECUTE` to `anon` when a function is created, and older dashboard SQL may still be in effect.

## Supabase Auth

Enable leaked-password protection (Have I Been Pwned) in the Supabase dashboard:

Authentication → Providers → Email → Password security → leaked password protection.

## Edge Functions with `verify_jwt = false`

`supabase/config.toml` sets `verify_jwt = false` for several functions. The gateway then does not require a JWT; each function must authenticate the caller itself (session, shared secret, or a truly public read).

Review these before tightening the gateway, because turning `verify_jwt` on can 401 calls that today send a manual `Authorization` header or no JWT:

- `square-create-payment` (confirm the deployed setting; it validates the user inside the function and is not listed in `config.toml`)
- `account-deletion`
- `referral-invite`
- `pro-plan-checkout`, `pro-plan-cancel`, `trial-checkout`, `trial-token-admin`
- `ensure-platform-admin`
- `booking-sms-notify`, `send-app-email`, `request-password-reset`
- `square-oauth-start`, `square-oauth-callback`, `square-oauth-disconnect`
- `verify-rbq-license`, `seed-demo-pro`, `search-suggestions`

Also narrow `Access-Control-Allow-Origin: *` on those Edge Functions. It is **not** set on the Vercel HTML responses. Restrict it to `https://www.altshift.ca` (and local dev origins) in a separate functions deploy so browser calls from other sites cannot use the anon key against them.

## GitHub and demo data

- Make the production GitHub repo private. Do not do that from an app pull request.
- Remove demo professionals such as “John Pork” from the production database (do not delete them through an ad-hoc client script in this repo).
- Remove draft legal banners and placeholder legal copy once counsel approves the text. Until then, keep the draft notices. See `docs/LEGAL_REVIEW_REQUIRED.md`.

## Hosting notes from the front-end PR (no further action required to understand them)

- Hashed `/assets/*` responses are cached for one year, immutable. HTML routes use a short cache.
- Unknown multi-segment paths are not rewritten to `index.html`. Vercel serves `dist/404.html` (a copy of the SPA shell) with HTTP 404, and the client renders the Not Found page.
- A single alphanumeric path such as `/somepro` is still rewritten to `index.html` with HTTP 200, because it may be a public pro page. If the slug is not a verified pro, the client shows Not Found. An HTTP 404 for those URLs would need a live profile lookup and is out of scope here.
- Content-Security-Policy still allows `'unsafe-inline'` and `'unsafe-eval'` on scripts so Google Maps, Square Web Payments, and the inline boot styles keep working.

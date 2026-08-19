# Supabase Free-tier keep-alive

Free projects can pause after ~7 days of low database activity.

## What we added

1. Table `platform_keepalive` (one row) — migration `20260819170000_platform_keepalive.sql`
2. GitHub Action `.github/workflows/supabase-keepalive.yml` — runs every **3 days** (and manually via **Actions → Supabase keep-alive → Run workflow**)

## One-time GitHub setup

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |

Then open **Actions**, select **Supabase keep-alive**, and click **Run workflow** once to verify.

## Notes

- A few DB hits every few days is enough; this does not need to run hourly.
- Pro plan never pauses for inactivity — keep-alive is only needed on Free.
- Do not put the **service role** key in GitHub Actions for this; the anon key is enough.

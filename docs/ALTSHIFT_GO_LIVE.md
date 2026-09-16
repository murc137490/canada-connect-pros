## Critical: never keep premierservices.ca in the address bar

**Policy:** Any visit to `premiereservices.ca` or `www.premiereservices.ca` must **301 permanently** to the matching path on `https://www.altshift.ca`. The old domain must not stay in the browser URL bar.

This is enforced in:
- `vercel.json` — host redirects from both Première hosts → `https://www.altshift.ca/:path*`
- `src/components/LegacyHostRedirect.tsx` — client fallback if a cached HTML still loads on the old host
- `src/lib/authSiteUrl.ts` — OAuth/`?code=` returns use AltShift in production

### 1) Vercel — site URL env var

1. Open [vercel.com](https://vercel.com) → your project  
2. **Settings** → **Environment Variables**  
3. Find `VITE_SITE_URL`  
4. Change value to exactly: `https://www.altshift.ca`  
5. Apply to **Production** (and Preview if listed)  
6. **Save**  
7. **Deployments** → latest → **⋯** → **Redeploy** (fresh rebuild)

Without this redeploy, the browser build can still bake the old URL into emails / OAuth helpers.

### 2) Supabase — Auth Site URL (required for Google login)

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project  
2. Left: **Authentication** → **URL Configuration**  
3. **Site URL** → exactly: `https://www.altshift.ca`  
4. **Redirect URLs** must include:
   - `https://www.altshift.ca/**`
   - `https://www.altshift.ca/auth/callback`
   - `http://localhost:3000/**` (local)
5. **Save**

If Site URL is still `premiereservices.ca`, Google can return a `?code=` that never reaches `/auth/callback` and login fails.

Also in **Google Cloud Console** → OAuth client:
- Authorized JavaScript origins: `https://www.altshift.ca`
- Authorized redirect URI: `https://hptzapnrnbqlptrstjxo.supabase.co/auth/v1/callback`
- Optional: rename the consent-screen app from “premiereservices” to “AltShift”

### 3) Supabase Edge secrets (emails / OAuth return)

1. Project → **Edge Functions** → **Secrets**  
2. Set:
   - `SITE_URL` = `https://www.altshift.ca`
   - `PUBLIC_SITE_URL` = `https://www.altshift.ca`
   - `FROM_NAME` = `AltShift`
3. Save  

(AI chat function `ai-chat-hf` was redeployed with AltShift-only links.)

### Why `?code=...` used to appear on premierservices.ca

That `code` is a login/OAuth return. Supabase/Google sent you back to whatever **Site URL / redirect origin** was configured. After steps 1–2, new logins land on `https://www.altshift.ca/...`. Old Première hosts then 301 to AltShift if anyone hits them.

---

# Domain setup: AltShift only (Première redirects)

**Goal**

- `https://www.altshift.ca` → primary public URL (what users always see)  
- `https://www.premiereservices.ca` / `https://premiereservices.ca` → **301 →** same path on `https://www.altshift.ca`  
- `https://altshift.ca` → **301 →** `https://www.altshift.ca`

Emails / OAuth “home” links must use **AltShift** (`VITE_SITE_URL` / Supabase `SITE_URL`).

---

## A) Vercel — domains

1. Open [vercel.com](https://vercel.com) → your project → **Settings** → **Domains**.  
2. Ensure:

   | Domain | What Vercel should do |
   |--------|------------------------|
   | `www.altshift.ca` | Production (main) |
   | `altshift.ca` | Redirect to `www.altshift.ca` (also covered by `vercel.json`) |
   | `www.premiereservices.ca` | Same project (redirect handled by `vercel.json` → AltShift) |
   | `premiereservices.ca` | Same project (redirect handled by `vercel.json` → AltShift) |

3. **Environment Variables** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_SITE_URL` | `https://www.altshift.ca` |
   | `VITE_SUPABASE_URL` | (your existing Supabase URL) |
   | `VITE_SUPABASE_ANON_KEY` | (your existing anon key) |

4. **Deployments** → open latest → **⋯** → **Redeploy**.

---

## B) DNS — both zones still point at Vercel

Keep DNS for **both** brands pointed at this Vercel project so the Première host redirects can run. If Première DNS stops pointing here, old links will fail instead of jumping to AltShift.

### For `altshift.ca`

- **A** `@` → Vercel IP (or the A/CNAME Vercel lists)  
- **CNAME** `www` → `cname.vercel-dns.com.` (or Vercel’s value)

### For `premiereservices.ca`

- Point `@` and `www` to the **same** Vercel project so redirects fire.

**Test in the browser (incognito)**

- `https://www.altshift.ca/dashboard?tab=pro` stays on AltShift  
- `https://www.premiereservices.ca/dashboard?tab=pro` → address bar becomes `https://www.altshift.ca/dashboard?tab=pro`  
- Same for `?tab=bookings` and `?tab=invoices`  
- `https://premiereservices.ca/...` → `https://www.altshift.ca/...`

---

## C) Supabase Auth

1. **Site URL:** `https://www.altshift.ca`  
2. **Redirect URLs:**
   - `https://www.altshift.ca/**`  
   - `https://www.altshift.ca/auth/callback`  
   - `http://localhost:3000/**`

Première redirect URLs are no longer required for normal login (hosts 301 first).

---

## D) Supabase Edge Function secrets

| Name | Value |
|------|--------|
| `SITE_URL` | `https://www.altshift.ca` |
| `PUBLIC_SITE_URL` | `https://www.altshift.ca` |
| `FROM_NAME` | `AltShift` |

Redeploy edge functions that embed links after changing secrets if needed.

---

## E) Square / Apple Pay

Register **www.altshift.ca** (and apex if used) for Apple Pay domain verification. Première domains are legacy; do not rely on them for new wallet setup.

---

## Quick checklist

- [ ] `VITE_SITE_URL=https://www.altshift.ca` on Vercel + redeploy  
- [ ] Supabase Site URL = `https://www.altshift.ca`  
- [ ] Edge `SITE_URL` / `PUBLIC_SITE_URL` = AltShift  
- [ ] Opening any Première URL ends with **altshift.ca** in the address bar  
- [ ] OAuth/`?code=` lands on AltShift  

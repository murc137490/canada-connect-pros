## Critical: make Gemini / auth use altshift.ca (not premierservices.ca)

The website code can say AltShift while **Vercel** and **Supabase** still have the old URL saved. That is why you still see Premiere links and `https://www.premiereservices.ca/?code=...`.

### 1) Vercel — change the site URL env var

1. Open [vercel.com](https://vercel.com) → your project  
2. **Settings** → **Environment Variables**  
3. Find `VITE_SITE_URL`  
4. Change value to exactly: `https://www.altshift.ca`  
5. Apply to **Production** (and Preview if listed)  
6. **Save**  
7. **Deployments** → latest → **⋯** → **Redeploy** (do a fresh rebuild)

Without this redeploy, the browser build keeps the old URL baked in.

### 2) Supabase — change Auth Site URL

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project  
2. Left: **Authentication**  
3. **URL Configuration**  
4. **Site URL** → set to: `https://www.altshift.ca`  
5. Under **Redirect URLs**, keep both:
   - `https://www.altshift.ca/**`
   - `https://www.premiereservices.ca/**`
6. **Save**

### 3) Supabase Edge secrets (emails / OAuth return)

1. Project → **Edge Functions** → **Secrets** (or Project Settings → Edge Functions)  
2. Set:
   - `SITE_URL` = `https://www.altshift.ca`
   - `PUBLIC_SITE_URL` = `https://www.altshift.ca`
   - `FROM_NAME` = `AltShift`
3. Save  

(AI chat function `ai-chat-hf` was redeployed with AltShift-only links.)

### Why `?code=...` appeared on premierservices.ca

That `code` is a login/OAuth return. Supabase/Google sent you back to whatever **Site URL / redirect origin** was configured (still Première). After steps 1–2 above, new logins should land on `https://www.altshift.ca/...`.

---

# Dual domain setup: AltShift + Première Services

**Goal**

- `https://www.altshift.ca` → primary public / search URL  
- `https://www.premiereservices.ca` → still works (same website)  
- Google should prefer **AltShift** in search results  

The app already sets a **canonical** tag to `https://www.altshift.ca…` on every page, even if someone opens Première Services. Apex domains redirect to their own `www` versions only (they do **not** force Première → AltShift).

Emails / OAuth “home” links should use **AltShift** (`VITE_SITE_URL` / Supabase `SITE_URL`).

---

## A) Vercel — attach both domains

1. Open [vercel.com](https://vercel.com) → log in.  
2. Open your **project** (the one that deploys this repo).  
3. Top tabs → **Settings**.  
4. Left sidebar → **Domains**.  
5. Add these four (if missing), one at a time:

   | Domain | What Vercel should do |
   |--------|------------------------|
   | `www.altshift.ca` | Production (main) |
   | `altshift.ca` | Redirect to `www.altshift.ca` |
   | `www.premiereservices.ca` | Production (same project) |
   | `premiereservices.ca` | Redirect to `www.premiereservices.ca` |

6. For each domain, Vercel shows DNS records. Keep that tab open for section B.

7. Still in **Settings** → left → **Environment Variables** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_SITE_URL` | `https://www.altshift.ca` |
   | `VITE_SUPABASE_URL` | (your existing Supabase URL) |
   | `VITE_SUPABASE_ANON_KEY` | (your existing anon key) |

8. **Deployments** → open latest → **⋯** → **Redeploy** (so `VITE_SITE_URL` is baked into the build).

---

## B) DNS — where your domains are registered

Do this in **Cloudflare**, **GoDaddy**, **Namecheap**, or whoever hosts DNS for each domain.

### For `altshift.ca`

1. Open the DNS zone for `altshift.ca`.  
2. Add the records Vercel showed (usually):

   - **A** `@` → `76.76.21.21` (Vercel), **or** the exact A/CNAME Vercel lists  
   - **CNAME** `www` → `cname.vercel-dns.com.` (or the value Vercel shows)

3. If using **Cloudflare**: for those records you can use **DNS only** (grey cloud) first; SSL is easier. Later you can proxy if you want.  
4. Wait until Vercel Domains shows **Valid** / SSL issued for `www.altshift.ca`.

### For `premiereservices.ca`

1. Open that DNS zone.  
2. Point `@` and `www` the same way to the **same** Vercel project (same A/CNAME values).  
3. Wait until Vercel shows both Première domains as valid.

**Test in the browser**

- `https://www.altshift.ca` loads the site  
- `https://www.premiereservices.ca` loads the **same** site  
- `https://altshift.ca` jumps to `www.altshift.ca`  
- `https://premiereservices.ca` jumps to `www.premiereservices.ca`

---

## C) Supabase Auth — both domains must be allowed

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project.  
2. Left sidebar → **Authentication**.  
3. Top → **URL Configuration** (sometimes under **Sign In / Providers** → scroll, or **Settings** inside Auth).  
4. Set:

   - **Site URL:** `https://www.altshift.ca`  
     (this is the “preferred” home for auth emails)

5. Under **Redirect URLs**, add **all** of these (Add URL for each):

   - `https://www.altshift.ca/**`  
   - `https://www.altshift.ca/auth/callback`  
   - `https://www.premiereservices.ca/**`  
   - `https://www.premiereservices.ca/auth/callback`  
   - `http://localhost:3000/**` (local dev)

6. Click **Save**.

Without the Première redirect URLs, login on `premiereservices.ca` will break even though the site loads.

---

## D) Supabase Edge Function secrets

1. Supabase Dashboard → project → left **Edge Functions**.  
2. Open **Secrets** (or **Project Settings** → **Edge Functions** → Secrets).  
3. Set / update:

   | Secret | Value |
   |--------|--------|
   | `SITE_URL` | `https://www.altshift.ca` |
   | `PUBLIC_SITE_URL` | `https://www.altshift.ca` |
   | `FROM_NAME` | `AltShift` |
   | `FROM_EMAIL` | `support@altshift.ca` or `no-reply@altshift.ca` |
   | `REPLY_TO_EMAIL` | `support@altshift.ca` |

4. Redeploy functions that send email or return to the site (Dashboard → each function → **Deploy**, or CLI `supabase functions deploy`).  
   Priority: `send-app-email`, `account-deletion`, `referral-invite`, `square-oauth-callback`, `ai-chat-hf`, `square-register-apple-pay-domain`.

---

## E) Resend (email domain)

1. Open [resend.com](https://resend.com) → **Domains**.  
2. **Add Domain** → `altshift.ca`.  
3. Resend shows DNS records (SPF, DKIM, etc.).  
4. In your DNS provider for `altshift.ca`, create those records exactly.  
5. Back in Resend → wait until domain is **Verified**.  
6. Keep `premiereservices.ca` verified for a while if old mail still sends from it; new mail should use AltShift.

7. Supabase → **Authentication** → **Email Templates**: paste the HTML from `supabase/email-templates/` in this repo (already says AltShift), or confirm the “From” address uses the verified AltShift domain.

---

## F) Google — Maps / OAuth (so both domains don’t get blocked)

1. Open [Google Cloud Console](https://console.cloud.google.com) → your project.  
2. **APIs & Services** → **Credentials**.  
3. Open your **API key** used for Maps:

   - **Application restrictions** → **HTTP referrers**  
   - Add:  
     - `https://www.altshift.ca/*`  
     - `https://www.premiereservices.ca/*`  
     - `http://localhost:3000/*`  
   - Save  

4. If you use **OAuth 2.0 Client ID** (Google login):

   - Open that client  
   - **Authorized JavaScript origins:** add both `https://www.altshift.ca` and `https://www.premiereservices.ca`  
   - **Authorized redirect URIs:** include your Supabase callback  
     `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`  
   - Save  

5. **OAuth consent screen** → App name can be **AltShift**; support email `support@altshift.ca`.

---

## G) Square

1. [squareup.com/dashboard](https://squareup.com/dashboard) (or developer portal for the app).  
2. Update public / statement name toward **AltShift** where the UI allows (length limits apply).  
3. Developer app → ensure OAuth redirect is still your Supabase function URL.  
4. Register Apple Pay for **both** storefront hosts if you use Apple Pay on both:

   - `www.altshift.ca`  
   - `www.premiereservices.ca`  

   (Your edge function `square-register-apple-pay-domain` — call once per domain, or use Square’s domain registration UI.)  
5. Confirm `public/.well-known/apple-developer-merchantid-domain-association` is deployed on **both** domains (same Vercel project = same file).

---

## H) Make Google prefer AltShift in search

1. Go to [Google Search Console](https://search.google.com/search-console).  
2. **Add property** → URL prefix → `https://www.altshift.ca` → verify (DNS TXT or HTML tag).  
3. Optionally also add `https://www.premiereservices.ca` so you can see old traffic.  
4. On the **AltShift** property:  
   - **Sitemaps** → submit `https://www.altshift.ca/sitemap.xml`  
5. On the Première property (if added):  
   - You can leave it; canonical tags tell Google the AltShift URL is preferred.  
6. Expect days–weeks for search results to shift; both sites working does **not** mean Google instantly drops Première.

---

## I) Quick checklist before you tell people

- [ ] `www.altshift.ca` loads  
- [ ] `www.premiereservices.ca` loads (same app, AltShift branding)  
- [ ] View source / Inspect → `<link rel="canonical" href="https://www.altshift.ca/...">`  
- [ ] Signup email links open on **altshift.ca**  
- [ ] Login works on **both** www hosts  
- [ ] Maps / Google login work on both  
- [ ] Search Console sitemap submitted for AltShift  

---

## What you do *not* need

- You do **not** need to delete `premiereservices.ca`.  
- You do **not** need users to type AltShift only — bookmarks to Première still work.  
- You do **not** need separate Vercel projects; one project, four domains is correct.

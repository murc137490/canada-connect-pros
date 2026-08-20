# Apple Pay domain verification — do it yourself (from scratch)

This is the full checklist for **Première Services** (`www.premiereservices.ca`).  
Goal: Square can download one specific file and mark the domain **Verified**.

---

## What you are trying to do (simple version)

1. Square gives you a secret **verification file**.
2. You put that file on your website at a fixed address.
3. Square’s computers download it and check the size/content.
4. If it matches, Apple Pay can show on your site (Safari + Wallet).

**You do not need Vite settings for this.**  
**The hard part for you is Cloudflare cache**, not React.

---

## Important rules (read once)

| Rule | Why |
|------|-----|
| Verify **`www.premiereservices.ca`** | That is the real site. |
| Skip / remove **`premiereservices.ca`** (no www) until later | It redirects to www; Square fails on redirects. |
| Keep the file as **hex** (long string of `0-9A-F`) | About **9098** characters, starts with `7B227073…` |
| Do **not** “decode”, “format as JSON”, or open/save in Word | That creates ~**4549** bytes starting with `{"pspId":` — Square calls that **“partial response”** |
| Browser download prompt is **normal** | Square asks for the file to download |
| Your PC can look “fine” while Square still fails | Your PC and Square may hit different caches (Cloudflare) |

---

## Part A — Get the file from Square

1. Open [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Open app **premiere services**
3. Switch to **Production** (not Sandbox)
4. Go to **Apple Pay** (left sidebar)
5. Under **Domain verifications**, use **`www.premiereservices.ca`**
   - If it is missing: **Add domain** → type exactly `www.premiereservices.ca`
   - If **`premiereservices.ca`** (no www) is listed: you can leave it, but **do not** rely on it; prefer removing it for now
6. Open **Verify domain** / **Retry verification**
7. Click **Download verification file**
8. Save it with this exact name (no `.txt`, no `.json`):

   `apple-developer-merchantid-domain-association`

9. Open the file in **Notepad** (not Word):
   - First characters should look like: `7B227073704964223A…`
   - It should **not** start with `{`
   - File size should be about **9 KB** (~9098 characters), not ~4.5 KB

If it starts with `{`, you have a decoded/wrong file. Download again from Square and do not transform it.

---

## Part B — Put the file in your project and deploy

### B1. Put the file in the repo

1. On your computer, open the project folder: `Premiere` (or `canada-connect-pros`)
2. Put the downloaded file here (replace if it exists):

   `apple-pay/apple-developer-merchantid-domain-association`

3. Open a terminal in the project root and run:

   ```bash
   node scripts/sync-apple-pay-middleware.mjs
   ```

   This updates `middleware.ts` so Vercel serves the file.

4. Commit and push to GitHub `main` (so Vercel redeploys), for example:

   ```bash
   git add apple-pay/apple-developer-merchantid-domain-association middleware.ts
   git commit -m "Update Square Apple Pay domain association file."
   git push origin main
   ```

5. Wait for Vercel deploy to finish (Vercel dashboard → Deployments → Ready).

### B2. What this project already does

- `middleware.ts` serves:

  `https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

- No Vite plugin is required.

---

## Part C — Fix Cloudflare (this is why Square still fails)

Right now, public internet (including Square) goes through **Cloudflare**, and Cloudflare is still giving the **old 4549-byte JSON** file.

### C1. Log into Cloudflare

1. Open [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Select the zone **`premiereservices.ca`**

### C2. Stop Cloudflare from caching this file (do this first)

1. Go to **Caching** → **Cache Rules** (or **Rules** → **Cache Rules**)
2. **Create rule**
3. Name: `Bypass well-known`
4. When incoming requests match:
   - Field: **URI Path**
   - Operator: **starts with**
   - Value: `/.well-known/`
5. Then:
   - **Cache eligibility** → **Bypass cache**
6. **Deploy** the rule

(If your UI uses expression editor, use:  
`(starts_with(http.request.uri.path, "/.well-known/"))` → Bypass cache)

### C3. Purge old cache

1. Go to **Caching** → **Configuration**
2. Click **Purge Everything**  
   (or Custom purge of this exact URL):

   `https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

3. Confirm purge. Wait **1–2 minutes**.

### C4. Optional but helpful: check DNS proxy

1. Go to **DNS** → **Records**
2. Find `www`
3. Orange cloud = proxied through Cloudflare (normal for you)
4. Keep it proxied **if** you completed C2 + C3  
   - Only turn proxy off (grey cloud) if you are stuck and want a temporary test

---

## Part D — Prove the file is correct before clicking Verify

Do these checks **after** Cloudflare purge.

### Check 1 — Open the URL

On your phone using **cellular data** (not home Wi‑Fi), or a private/incognito window, open:

https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association

Expected:

- File **downloads**
- If you open it in Notepad, it starts with `7B227073…`
- Not with `{`

### Check 2 — PowerShell length check

In PowerShell:

```powershell
curl.exe -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" -o "$env:TEMP\apple-pay-check.txt"
(Get-Item "$env:TEMP\apple-pay-check.txt").Length
Get-Content "$env:TEMP\apple-pay-check.txt" -TotalCount 1 | ForEach-Object { $_.Substring(0,20) }
```

Expected:

- Length: **9098**
- Start: **`7B227073704964223A22`**

If you still see **4549** and start with **`{"pspId"`**:

- Cloudflare purge/rule did not take effect yet
- Repeat Part C, wait 2 minutes, test again on phone data

### Check 3 — Headers (optional)

```powershell
curl.exe -sI "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
```

Nice to see:

- `HTTP/1.1 200`
- `X-Assoc-Bytes: 9098` (from our middleware, if Cloudflare is not stripping it)
- `Content-Disposition` containing `attachment` (download)

`Server: cloudflare` is normal when proxied.

---

## Part E — Verify in Square

Only after Check 2 shows **9098** and hex start:

1. Square Developer → **premiere services** → **Production** → **Apple Pay**
2. On row **`www.premiereservices.ca`** click **Retry verification** / **Verify**
3. It should become **Verified** within seconds

If it still says **partial response**:

- Square is still seeing 4549 → Cloudflare still caching old file
- Purge again, wait, re-run Check 2 on phone data

---

## Part F — After it is verified

1. Apple Pay can appear in **Safari** (Mac/iPhone) with **Wallet** set up  
2. Often **not** in Chrome  
3. Your site must use **Production** Square Application ID / Location ID on the live site  
4. Card payments can work even if Apple Pay domain is not verified; Apple Pay button needs this domain step

---

## Quick “am I done?” checklist

- [ ] File from Square is hex (~9098), starts `7B22…`
- [ ] File is in `apple-pay/` and `node scripts/sync-apple-pay-middleware.mjs` was run
- [ ] Pushed to GitHub and Vercel deploy is Ready
- [ ] Cloudflare Cache Rule: bypass `/.well-known/`
- [ ] Cloudflare Purge Everything done
- [ ] Public check shows length **9098**, not 4549
- [ ] Square **www** domain shows **Verified**

---

## Common mistakes

1. **Decoded the hex to JSON** → always fails with partial response  
2. **Verified apex without www** → redirect fails  
3. **Only purged nothing / only tested on home Wi‑Fi** → you still see a “good” cached copy while Square sees Cloudflare’s old copy  
4. **Edited the file in Word / added a `.txt` extension** → wrong content or wrong path  
5. **Sandbox vs Production** → download and verify in the **same** environment (you want Production)

---

## If you want the absolute nuclear Cloudflare test

1. Cloudflare DNS → `www` → set proxy to **DNS only** (grey cloud) for 10 minutes  
2. Wait 2–5 minutes  
3. Re-run the PowerShell length check → must be 9098  
4. Verify in Square  
5. Turn orange cloud back on **after** Cache Rule bypass for `/.well-known/` is active

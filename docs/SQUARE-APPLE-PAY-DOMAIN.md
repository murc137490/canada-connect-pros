# Apple Pay domain verification (Square)

Square may require you to **verify your website domain** for Apple Pay. You must host the association file at a fixed URL over **HTTPS**.

## Required URL

After deploy, this must return **exactly** the file Square gives you (no HTML wrapper, no login page):

`https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

**Use the `www` URL.** Visiting `https://premiereservices.ca/...` (no www) redirects to www. In the Square list, click **Retry verification** on **`www.premiereservices.ca`**.

It is **normal** if the browser asks to **download** the file.

## Critical: do not decode the file

Square’s download is a long **hex string** (starts with `7B227073704964...`, about **9098** characters).

Host it **exactly as downloaded**. Do **not** decode hex to JSON. If the live file starts with `{"pspId":` and is ~4549 bytes, Square reports **“partial response”** (it expected ~9098 bytes).

Check:

```bash
curl -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" | wc -c
# expect ~9098
```

## Steps (this repo — Vite)

1. In Square, **Download verification file**.
2. Save it as `apple-developer-merchantid-domain-association` (no `.txt`). Keep the hex digits as-is.
3. Put it at `public/.well-known/apple-developer-merchantid-domain-association`
4. Sync Edge Middleware: `node scripts/sync-apple-pay-middleware.mjs`
5. Commit and deploy.
6. In Square, **Verify** / **Retry** on **`www.premiereservices.ca`**.

Verification is **instant** once the correct file is live (not a multi-hour wait).

## If verification fails

- **“Partial response”** — Almost always: hex was decoded to JSON (half size), or you verified the non-www host that redirects.
- **HTTPS only**
- **No SPA fallback** — must not be `index.html`
- Fresh download from the **same** Square app / environment

## What else you need

- HTTPS on the real domain
- Square Apple Pay / Web payments setup with domain verified
- Safari + Wallet for Apple Pay on the web
- Production Square Application ID on the live site

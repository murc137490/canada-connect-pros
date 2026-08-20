# Apple Pay domain verification (Square)

Square may require you to **verify your website domain** for Apple Pay. You must host Apple’s association file at a fixed URL over **HTTPS**.

## Required URL

After deploy, this must return **exactly** the file Square gives you (no HTML wrapper, no login page):

`https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

**Use the `www` URL.** Visiting `https://premiereservices.ca/...` (no www) redirects to www. Square’s checker often fails on that redirect with “partial response.” In the Square list, click **Retry verification** on **`www.premiereservices.ca`**.

It is **normal** if the browser asks to **download** the file. Square’s own dialog says the file should download when you visit the URL.

## Steps (this repo — Vite)

1. In **Square Dashboard** (or Developer Dashboard), open the **Download verification file** for **Add domain**.
2. Save the downloaded file with **this exact name** (no `.txt` extension):

   `apple-developer-merchantid-domain-association`

   The file should be **JSON** (first character `{`). If you only have a long string of **hex digits** (`0-9a-f`), decode it to UTF-8 JSON (e.g. `Buffer.from(hex, 'hex')` in Node) or download again from Square.

3. Put it in this project at:

   `public/.well-known/apple-developer-merchantid-domain-association`

   Vite copies everything under `public/` to the root of `dist/`.

4. **Commit and deploy** your site.

5. Confirm (expect HTTP 200, JSON body starting with `{`):

   ```bash
   curl -sI "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
   curl -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" | head -c 80
   ```

6. In Square, click **Verify** / **Retry verification** on **`www.premiereservices.ca`**.

## If verification fails

- **“Partial response”** — Usually Square hit the **non-www** URL and followed a redirect. Verify **www** instead.
- **HTTPS only** — HTTP will not work for production verification.
- **No SPA fallback** — The file must be a **static asset**, not your React `index.html`.
- **Exact path** — Typos in the folder name or filename break verification.
- **CDN cache** — Purge cache after uploading a new file.

## File contents

Do **not** invent the file. It is **merchant-specific**; always use the file Square provides for your application.

## What you need besides the verification file

- **HTTPS on your real domain**
- **Square Dashboard** — Complete **Web payments** / **Apple Pay** setup; add and verify the domain
- **Safari (macOS / iOS) with Wallet** — Apple Pay on the web usually shows in Safari, not Chrome
- **Production Square Application ID** on the live site when you go live

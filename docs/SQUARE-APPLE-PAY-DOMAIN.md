# Apple Pay domain verification (Square)

Square may require you to **verify your website domain** for Apple Pay. You must host Apple’s association file at a fixed URL over **HTTPS**.

## Required URL

After deploy, this must return **exactly** the file Square gives you (no HTML wrapper, no redirect to login):

`https://premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

If you use **www**, also verify the domain Square asks for (often add both apex and `www` in Square, or use the canonical host only).

## Steps (this repo — Vite)

1. In **Square Dashboard** (or Developer Dashboard), open the **Download verification file** for **Add domain**.
2. Save the downloaded file with **this exact name** (no `.txt` extension):

   `apple-developer-merchantid-domain-association`

   The file should be **JSON** (first character `{`). If you accidentally saved a long string of only **hex digits** (`0-9a-f`), that is not valid for Apple: decode it from hex to raw bytes (e.g. `Buffer.from(hex, 'hex')` in Node) or download again from Square.

3. Put it in this project at:

   `public/.well-known/apple-developer-merchantid-domain-association`

   Vite copies everything under `public/` to the root of `dist/`, so the live URL path is `/.well-known/apple-developer-merchantid-domain-association`.

4. **Commit and deploy** your site (rebuild so `dist` includes the file).

5. Confirm in a browser or terminal (expect HTTP 200 and non‑HTML body):

   ```bash
   curl -sI "https://premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
   ```

6. In Square, click **Verify** (or finish domain setup).

## If verification fails

- **HTTPS only** — HTTP will not work for production verification.
- **No SPA fallback** — The file must be served as a **static asset**, not your React `index.html`. On **Vercel**, this project’s `vercel.json` rewrite skips paths that contain a `.`, so `/.well-known/...` is not rewritten to `index.html`. If you use **Netlify** `/* /index.html 200`, static files in `dist` are still usually tried first; if you get HTML back, add an exception for `/.well-known/*`.
- **Exact path** — Typos in the folder name or filename break verification.
- **CDN cache** — Purge cache after uploading a new file.

## File contents

Do **not** invent the file. It is **merchant-specific**; always use the file Square provides for your application.

## What you need besides the verification file

- **HTTPS on your real domain** — Apple Pay on the web expects a verified production host (not `http://localhost`).
- **Square Dashboard** — Complete **Web payments** / **Apple Pay** setup for your application: add and verify the same domain you serve the site from, and use a **production** Application ID in the live build when you go live.
- **Safari (macOS / iOS) with Wallet** — On the web, Apple Pay is usually offered in **Safari** with a card in **Wallet**. Chrome on desktop often will not show the Apple Pay button even when everything else is correct.
- **Currency and region** — Your `PaymentForm` / `createPaymentRequest` uses **CA** and **CAD**, which matches typical Square + Apple Pay Canada flows.
- **No fake button** — The Square SDK only renders the real Apple Pay control when Apple’s criteria are met; until then, **Google Pay and card** still work. The app shows a short note that setup is in progress and that Apple Pay should work at go-live.

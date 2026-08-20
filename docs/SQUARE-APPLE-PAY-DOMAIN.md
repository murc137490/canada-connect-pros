# Apple Pay domain verification (Square)

No Vite changes are needed.

## Square checklist (both domains)

You have **two** rows in Square. Each must fetch the file **without a redirect**.

| Domain | What must happen |
|--------|------------------|
| `www.premiereservices.ca` | File returns **200**, ~9098 hex bytes, and **downloads** |
| `premiereservices.ca` | Same — **must not** 308 to www |

Today, Vercel’s **domain redirect** (apex → www) breaks `premiereservices.ca`. That setting is in the Vercel dashboard, not in Vite.

### Required Vercel step (apex)

1. Open [Vercel](https://vercel.com) → your project → **Settings** → **Domains**
2. Click **`premiereservices.ca`**
3. If it says **Redirect to** `www.premiereservices.ca`, **turn that redirect off** so the apex is a normal connected domain (same project)
4. Keep `www.premiereservices.ca` as the primary/canonical site

After that, this repo’s `vercel.json` still redirects normal pages from apex → www, but **not** `/.well-known/...`, so Square can verify both hosts.

### Then in Square

1. Confirm both URLs download the file (browser save dialog is expected):
   - https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association
   - https://premiereservices.ca/.well-known/apple-developer-merchantid-domain-association
2. Click **Retry verification** on **`www.premiereservices.ca`** first
3. Then retry **`premiereservices.ca`**

If you only need Apple Pay on www, you can **remove** the apex domain from Square entirely and only keep www.

## File format

Host Square’s file as **hex** (~9098 chars, starts `7B227073…`). Do not decode to JSON.

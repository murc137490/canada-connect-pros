# Apple Pay domain verification — AltShift

Goal: Square downloads one file and marks **www.altshift.ca** (and optionally apex) **Verified**.

## Important

| Rule | Why |
|------|-----|
| Prefer verifying **`www.altshift.ca`** | That is the live site users see. |
| Apex `altshift.ca` serves the association file **without** redirect | Square fails if the verify URL 301/308s. |
| Keep the file as **hex** (`7B227073…`) ~**9098** chars | Decoded JSON (~4549 bytes starting with `{`) is rejected as “partial response”. |
| HTTPS only | No localhost / HTTP. |

## Steps in Square

1. [Square Developer Dashboard](https://developer.squareup.com/apps) → your app → **Production**
2. Left: **Apple Pay**
3. **Add domain** → `www.altshift.ca` (recommended)
4. Optional second domain: `altshift.ca` (apex) — only after the association URL returns **200** with no redirect
5. **Download verification file** → save as `apple-developer-merchantid-domain-association` (no `.txt`)
6. Replace in this repo:
   - `apple-pay/apple-developer-merchantid-domain-association`
7. Run:
   ```bash
   node scripts/sync-apple-pay-middleware.mjs
   node scripts/write-apple-pay-hex.mjs
   ```
8. Commit, push, wait for Vercel deploy
9. In Square: **Verify** / **Retry verification**

## Check the file is live

```bash
curl.exe -sI "https://www.altshift.ca/.well-known/apple-developer-merchantid-domain-association"
curl.exe -sI "https://altshift.ca/.well-known/apple-developer-merchantid-domain-association"
```

Expect:
- **200** (not 301/308)
- `X-Assoc-Bytes: 9098` (or Content-Length 9098)
- `Content-Disposition: attachment; filename="apple-developer-merchantid-domain-association"`

```bash
curl.exe -s "https://www.altshift.ca/.well-known/apple-developer-merchantid-domain-association" | more
```

First characters must be `7B227073…`, not `{`.

## After verified

Apple Pay shows in Safari (iPhone/Mac with Wallet). Card / Google Pay still work without this step.

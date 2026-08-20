# Apple Pay domain verification (Square)

## Root cause (Première)

`www.premiereservices.ca` is fronted by **Cloudflare**. Square’s crawler uses public DNS → Cloudflare.

Cloudflare was still serving an **old cached** association file (**4549** bytes of decoded JSON). Square expects **9098** hex bytes. The dashboard calls that a **“partial response.”**

Your PC may hit Vercel directly (or a fresh edge) and download the correct file, while Square still gets Cloudflare’s stale copy.

## Fix (do this in order)

### 1. Cloudflare — purge cache

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → zone for `premiereservices.ca`
2. **Caching** → **Configuration** → **Purge Everything** (or purge  
   `https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`)
3. Recommended: **Caching** → **Cache Rules** → bypass cache for  
   `http.request.uri.path starts with "/.well-known/"`

### 2. Confirm Square will see hex (use a public resolver)

```bash
# Should be ~9098 and start with 7B227073...
curl -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" | wc -c
curl -sI "https://1.1.1.1" # not this — use normal curl after purge:
curl -sI "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
# expect header X-Assoc-Bytes: 9098 and X-Assoc-Rev: hex-9098-...
```

Or open the URL in a private window / phone data (not only home Wi‑Fi).

### 3. Square Production

Verify **`www.premiereservices.ca` only**. Remove apex if it redirects.

## Repo notes

- Source file: `apple-pay/apple-developer-merchantid-domain-association` (**hex**, do not decode)
- Served by `middleware.ts` (run `node scripts/sync-apple-pay-middleware.mjs` after replacing the file)
- No Vite config needed

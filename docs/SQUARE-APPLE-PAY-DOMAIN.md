# Apple Pay domain verification (Square)

No Vite changes needed.

## What Square actually checks

Square’s API error (when it fails) looks like:

`expected … to return 9098 bytes but instead returned 4549`

- **9098** = correct **hex** file from Square  
- **4549** = hex was **decoded to JSON** (wrong)

Your browser can download the correct file while Square still hits a **stale CDN edge** serving the old JSON. That shows up as “partial response” in the dashboard.

## Fix checklist

1. Association is served from **Edge Middleware** only (`middleware.ts`), source file in `apple-pay/apple-developer-merchantid-domain-association` (hex).
2. In **Vercel** → Project → **Deployments** → latest → **Redeploy** → enable **Clear cache and redeploy** (wording may vary).
3. Confirm every region sees hex + revision header:

   ```bash
   curl -sI "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
   # expect: X-Assoc-Bytes: 9098  and  X-Assoc-Rev: hex-9098-...
   curl -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" | wc -c
   # expect: 9098
   ```

4. In Square **Production**, verify **only** `www.premiereservices.ca`.
5. Optional: remove `premiereservices.ca` (apex) from Square until Vercel’s apex→www redirect is turned off for that host.

## Update the file later

Replace `apple-pay/apple-developer-merchantid-domain-association` with Square’s hex download, then:

`node scripts/sync-apple-pay-middleware.mjs`

Commit, push, clear Vercel cache redeploy.

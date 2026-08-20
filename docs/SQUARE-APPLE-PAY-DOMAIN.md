# Apple Pay domain verification (Square)

No Vite config is required. The file lives in `public/.well-known/` and is copied to the site root at build time.

## Required URL

`https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association`

**Only verify `www.premiereservices.ca`.** The apex `premiereservices.ca` **308-redirects** to www; Square/Apple do not accept redirects, so verifying the non-www domain always fails.

## Critical: host the hex file as-is

Square’s file is ~**9098** hex characters starting with `7B227073704964…`.

Do **not** decode it to JSON. Decoded JSON (~4549 bytes starting with `{"pspId":`) is rejected as **“partial response”**.

Our live file must match Square’s canonical copy:

https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association

## Steps

1. Download the verification file from Square (or use the canonical URL above).
2. Save as `public/.well-known/apple-developer-merchantid-domain-association` (hex digits only, no decode).
3. Commit, deploy.
4. Confirm:

   ```bash
   curl -s "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association" | wc -c
   # expect 9098
   curl -sI "https://www.premiereservices.ca/.well-known/apple-developer-merchantid-domain-association"
   # expect 200 and Content-Length: 9098
   ```

5. In Square, **Retry verification** only on **`www.premiereservices.ca`**. It should succeed immediately.

## If it still fails

- You clicked Verify on **premiereservices.ca** (no www) → use **www** only.
- Get the real error via API (needs your Square access token):

  ```bash
  curl https://connect.squareup.com/v2/apple-pay/domains \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"domain_name\":\"www.premiereservices.ca\"}"
  ```

  The `detail` field often says `expected … N bytes but instead returned M`.

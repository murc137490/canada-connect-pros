# Apple Pay / Square domain verification

Place Square’s downloaded file here **with this exact name** (no extension):

`apple-developer-merchantid-domain-association`

Then deploy. See **`docs/SQUARE-APPLE-PAY-DOMAIN.md`**.

**Note:** The file must be the **binary/JSON payload** from Square (usually starts with `{`). If a download is only a long string of `0-9a-f` characters, it was hex-encoded; decode hex → raw bytes before hosting (see doc).

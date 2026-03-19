# Google API Key Setup (Places, Maps, Geocoding)

Use one API key for address autocomplete, pro service-area map, and “serves your area” checks.

**Address dropdown in Request booking:** You do not download an API. In Google Cloud Console, enable **Places API**, add your key to `.env` as `VITE_GOOGLE_PLACES_API_KEY`, and restrict the key to your site (HTTP referrers). The booking address field will then show suggestions when the user types.

## Where to put the key

- **Local:** In your project root `.env`:
  ```env
  VITE_GOOGLE_PLACES_API_KEY=your_key_here
  ```
- **Production (e.g. Vercel):** Add the same variable in your project’s Environment Variables.

Do **not** commit the key in the repo. The key is only used in the browser (Places, Maps, Geocoding).

---

## Restrict the key (recommended)

In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your API key → **Application restrictions**:

1. Choose **HTTP referrers (web sites)**.
2. Add:
   - `https://www.premiereservices.ca/*`
   - `https://premiereservices.ca/*` (if you use the root domain)
   - `http://localhost:*`
   - `http://127.0.0.1:*`

Use **HTTP referrers** for this web app. Do **not** use:
- **IP addresses** — for server-side only; your front end runs in the user’s browser.
- **Android / iOS** — for mobile apps only.

Under **API restrictions**, limit the key to:
- **Places API** (autocomplete and place details)
- **Maps JavaScript API** (service-area map)
- **Geocoding API** (address → lat/lng for “serves your area”)

---

## Privacy (addresses)

- Addresses are used only for:
  - Pro: defining service area (center + radius).
  - Client: checking “does this pro serve my area?” and for booking.
- Pro and client addresses are **not** shown publicly on the site; only “Serves your area: Yes/No” (or similar) is shown based on distance.

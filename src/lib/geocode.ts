/**
 * Geocode via Supabase Edge Function (Google / geocoder.ca / Zippopotam),
 * with a direct Google client fallback when the edge call fails.
 * Successful lookups are cached in memory + sessionStorage so refresh / retries
 * do not flash "couldn't find that postal" on transient network failures.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface GeocodeLocation {
  lat: number;
  lng: number;
  city: string | null;
  province: string | null;
  formattedAddress?: string;
  /** Normalized postal returned by the geocoder when known (A1A 1A1). */
  postal?: string | null;
}

const CLIENT_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const GEO_SESSION_KEY = "altshift:geocodeCache:v1";
const memoryGeoCache = new Map<string, GeocodeLocation>();
/** In-flight dedupe so rapid remounts / Strict Mode don't hammer the edge function. */
const inflightGeo = new Map<string, Promise<GeocodeLocation | null>>();

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

function readSessionGeoCache(compact: string): GeocodeLocation | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_SESSION_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, GeocodeLocation>;
    const hit = map[compact];
    if (!hit || typeof hit.lat !== "number" || typeof hit.lng !== "number") return null;
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return null;
    return hit;
  } catch {
    return null;
  }
}

function writeGeoCache(compact: string, loc: GeocodeLocation): void {
  memoryGeoCache.set(compact, loc);
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(GEO_SESSION_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, GeocodeLocation>;
    map[compact] = {
      lat: loc.lat,
      lng: loc.lng,
      city: loc.city ?? null,
      province: loc.province ?? null,
      formattedAddress: loc.formattedAddress,
      postal: loc.postal ?? null,
    };
    const keys = Object.keys(map);
    if (keys.length > 40) {
      for (const k of keys.slice(0, keys.length - 40)) delete map[k];
    }
    sessionStorage.setItem(GEO_SESSION_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode — memory cache still helps
  }
}

/** Seed cache from a previously saved browse location (avoids re-hit on refresh). */
export function seedGeocodeCache(
  postal: string,
  loc: { lat: number; lng: number; city?: string | null; province?: string | null; formattedAddress?: string }
): void {
  if (!isCompleteCanadianPostal(postal)) return;
  const compact = compactPostal(postal);
  writeGeoCache(compact, {
    lat: loc.lat,
    lng: loc.lng,
    city: loc.city ?? null,
    province: loc.province ?? null,
    formattedAddress: loc.formattedAddress,
    postal: formatCanadianPostalInput(postal),
  });
}

function cachedGeo(compact: string | null): GeocodeLocation | null {
  if (!compact) return null;
  return memoryGeoCache.get(compact) ?? readSessionGeoCache(compact);
}

/** Format Canadian postal as A1A 1A1 while typing. */
export function formatCanadianPostalInput(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function isCompleteCanadianPostal(raw: string): boolean {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact);
}

function compactPostal(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeQuery(address: string): { query: string; isCaPostal: boolean; compact: string | null } {
  const trimmed = address.trim();
  const compact = compactPostal(trimmed);
  const isCaPostal = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact);
  if (isCaPostal) {
    const spaced = `${compact.slice(0, 3)} ${compact.slice(3)}`;
    return { query: spaced, isCaPostal: true, compact };
  }
  return { query: trimmed, isCaPostal: false, compact: null };
}

type GoogleResult = {
  geometry?: { location?: { lat: number; lng: number } };
  formatted_address?: string;
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  types?: string[];
};

function postalFromComponents(
  components: { long_name: string; short_name: string; types: string[] }[] | undefined
): string | null {
  for (const c of components ?? []) {
    if (c.types.includes("postal_code")) return compactPostal(c.long_name || c.short_name);
  }
  return null;
}

function parseGoogleResult(first: GoogleResult): GeocodeLocation | null {
  const loc = first?.geometry?.location;
  if (loc == null || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;

  let city: string | null = null;
  let province: string | null = null;
  for (const c of first.address_components ?? []) {
    if (!city && (c.types.includes("locality") || c.types.includes("postal_town"))) city = c.long_name;
    if (!city && c.types.includes("sublocality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) province = c.short_name || c.long_name;
  }

  return {
    lat: loc.lat,
    lng: loc.lng,
    city,
    province,
    formattedAddress: first.formatted_address,
  };
}

type EdgeGeoAttempt = { loc: GeocodeLocation | null; notFound: boolean };

async function geocodeViaEdgeOnce(address: string, timeoutMs = 10000): Promise<EdgeGeoAttempt> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return { loc: null, notFound: false };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ address }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { loc: null, notFound: res.status === 404 || res.status === 400 };
    const data = (await res.json()) as GeocodeLocation & { error?: string; postal?: string | null };
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return { loc: null, notFound: false };
    return {
      loc: {
        lat: data.lat,
        lng: data.lng,
        city: data.city ?? null,
        province: data.province ?? null,
        formattedAddress: data.formattedAddress,
        postal: data.postal ?? null,
      },
      notFound: false,
    };
  } catch (err) {
    console.warn("Edge geocode error:", err);
    return { loc: null, notFound: false };
  }
}

/** Edge with short backoff — retry network/5xx once. A 404 is final. */
async function geocodeViaEdge(address: string): Promise<GeocodeLocation | null> {
  const first = await geocodeViaEdgeOnce(address);
  if (first.loc || first.notFound) return first.loc;
  await sleep(400);
  return (await geocodeViaEdgeOnce(address)).loc;
}

const FSA_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]$/;

/** Zippopotam FSA payload → city pin. Returns null unless `fsa` is exactly 3 characters. */
export function parseZippopotamFsaPayload(data: unknown, fsa: string): GeocodeLocation | null {
  const code = fsa.toUpperCase();
  if (!FSA_RE.test(code)) return null;
  if (!data || typeof data !== "object") return null;
  const places = (data as { places?: unknown }).places;
  if (!Array.isArray(places) || places.length === 0) return null;
  const place = places[0] as Record<string, unknown>;
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const city = typeof place["place name"] === "string" ? (place["place name"] as string) : null;
  const abbr = place["state abbreviation"];
  const state = place.state;
  const province =
    (typeof abbr === "string" && abbr) || (typeof state === "string" ? state : null);
  return {
    lat,
    lng,
    city,
    province,
    formattedAddress: [city, province, code, "Canada"].filter(Boolean).join(", "),
    postal: code,
  };
}

/** Browser-callable FSA centroid. Used only after an exact 6-character LDU lookup fails. */
async function geocodeViaZippopotamFsa(fsa: string): Promise<GeocodeLocation | null> {
  if (!FSA_RE.test(fsa)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/ca/${encodeURIComponent(fsa)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return parseZippopotamFsaPayload(await res.json(), fsa);
  } catch (err) {
    console.warn("Zippopotam FSA geocode error:", err);
    return null;
  }
}

/** Accept exact LDU or formatted_address containing it — never a different 6-char postal. */
function googleMatchesLdu(result: GoogleResult, wanted: string): boolean {
  const got = postalFromComponents(result.address_components);
  if (got === wanted) return true;
  if (got && got.length === 6 && got !== wanted) return false;
  const formatted = (result.formatted_address || "").toUpperCase();
  const spaced = `${wanted.slice(0, 3)} ${wanted.slice(3)}`;
  return formatted.includes(spaced) || formatted.replace(/\s+/g, "").includes(wanted);
}

async function geocodeViaGoogleClient(address: string): Promise<GeocodeLocation | null> {
  if (!CLIENT_KEY) return null;
  const { query, isCaPostal, compact } = normalizeQuery(address);

  const urls: string[] = [];
  if (isCaPostal) {
    const byComponent = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    byComponent.searchParams.set("components", `postal_code:${query}|country:CA`);
    byComponent.searchParams.set("key", CLIENT_KEY);
    byComponent.searchParams.set("region", "ca");
    urls.push(byComponent.toString());
  }

  const byAddress = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  byAddress.searchParams.set("address", isCaPostal ? `${query}, Canada` : query);
  byAddress.searchParams.set("key", CLIENT_KEY);
  byAddress.searchParams.set("region", "ca");
  if (isCaPostal) byAddress.searchParams.set("components", "country:CA");
  urls.push(byAddress.toString());

  try {
    for (const url of urls) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as { status: string; results?: GoogleResult[] };
      if (data.status !== "OK" || !data.results?.length) continue;

      const best = compact
        ? data.results.find((r) => googleMatchesLdu(r, compact))
        : data.results[0];
      if (!best) continue;

      const parsed = parseGoogleResult(best);
      if (parsed) {
        return {
          ...parsed,
          postal: compact ? `${compact.slice(0, 3)} ${compact.slice(3)}` : parsed.postal,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn("Client geocode error:", err);
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const loc = await geocodePostalToLocation(address);
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng, formattedAddress: loc.formattedAddress };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const loc = await reverseGeocodeToLocation(lat, lng);
  return loc?.formattedAddress ?? null;
}

async function reverseViaEdge(lat: number, lng: number): Promise<GeocodeLocation | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeLocation & { error?: string; postal?: string | null };
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    return {
      lat: data.lat,
      lng: data.lng,
      city: data.city ?? null,
      province: data.province ?? null,
      formattedAddress: data.formattedAddress,
      postal: data.postal ?? null,
    };
  } catch (err) {
    console.warn("Edge reverse geocode error:", err);
    return null;
  }
}

/** Reverse-geocode GPS coords to city/province + Canadian postal when available. */
export async function reverseGeocodeToLocation(lat: number, lng: number): Promise<GeocodeLocation | null> {
  const viaEdge = await reverseViaEdge(lat, lng);
  if (viaEdge?.postal && isCompleteCanadianPostal(formatCanadianPostalInput(viaEdge.postal))) {
    return {
      ...viaEdge,
      postal: formatCanadianPostalInput(viaEdge.postal),
    };
  }

  // Client Google often fails (referrer-restricted keys) — try only as secondary.
  if (CLIENT_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CLIENT_KEY}`;
      const res = await fetch(url);
      const data = (await res.json()) as { status: string; results?: GoogleResult[] };
      if (data.status === "OK" && data.results?.length) {
        const picked = pickReverseResult(data.results, lat, lng);
        if (picked?.postal && isCompleteCanadianPostal(formatCanadianPostalInput(picked.postal))) {
          return { ...picked, postal: formatCanadianPostalInput(picked.postal) };
        }
        if (picked && !viaEdge) return picked;
      }
    } catch (err) {
      console.warn("Client reverse geocode error:", err);
    }
  }

  return viaEdge;
}

function pickReverseResult(results: GoogleResult[], lat: number, lng: number): GeocodeLocation | null {
  const withPostal =
    results.find((r) => {
      const p = postalFromComponents(r.address_components);
      return !!p && p.length === 6;
    }) ?? results[0];
  if (!withPostal) return null;
  const parsed = parseGoogleResult(withPostal);
  if (!parsed) {
    return {
      lat,
      lng,
      city: null,
      province: null,
      formattedAddress: withPostal.formatted_address,
      postal: extractCanadianPostal(withPostal.formatted_address),
    };
  }
  const postal =
    postalFromComponents(withPostal.address_components) ??
    extractCanadianPostal(withPostal.formatted_address) ??
    parsed.postal ??
    null;
  const spaced =
    postal && compactPostal(postal).length === 6
      ? `${compactPostal(postal).slice(0, 3)} ${compactPostal(postal).slice(3)}`
      : postal;
  return {
    ...parsed,
    lat,
    lng,
    postal: spaced,
  };
}

export type DetectBrowserLocationResult =
  | { ok: true; location: GeocodeLocation }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "no_postal" | "timeout" };

function getCurrentPositionAsync(
  options: PositionOptions,
): Promise<{ ok: true; coords: GeolocationCoordinates } | { ok: false; code: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, code: 2 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, coords: pos.coords }),
      (err) => resolve({ ok: false, code: err.code }),
      options,
    );
  });
}

/** Browser GPS → reverse geocode. Requires user permission. */
export async function detectBrowserLocationPostal(): Promise<DetectBrowserLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unsupported" };
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    // Geolocation requires HTTPS (or localhost)
    return { ok: false, reason: "unavailable" };
  }

  let gps = await getCurrentPositionAsync({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 120_000,
  });

  if (!gps.ok) {
    // Retry with coarser/network location (often works on desktop)
    gps = await getCurrentPositionAsync({
      enableHighAccuracy: false,
      timeout: 25000,
      maximumAge: 300_000,
    });
  }

  if (!gps.ok) {
    if (gps.code === 1) return { ok: false, reason: "denied" };
    if (gps.code === 3) return { ok: false, reason: "timeout" };
    return { ok: false, reason: "unavailable" };
  }

  const lat = gps.coords.latitude;
  const lng = gps.coords.longitude;
  const loc = await reverseGeocodeToLocation(lat, lng);
  if (!loc) {
    return { ok: false, reason: "unavailable" };
  }
  const spaced = loc.postal ? formatCanadianPostalInput(loc.postal) : "";
  if (!spaced || !isCompleteCanadianPostal(spaced)) {
    return { ok: false, reason: "no_postal" };
  }
  return {
    ok: true,
    location: {
      ...loc,
      lat,
      lng,
      postal: spaced,
    },
  };
}

/**
 * Geocode postal/address.
 * Exact Canadian LDUs resolve via the edge function (Google / geocoder.ca / Photon).
 * Only when that exact lookup fails do we use the FSA centroid (Zippopotam),
 * so a mapped LDU such as J2G 9H7 keeps its own pin and an unmapped Granby
 * LDU such as J2G 1A1 still gets a city.
 */
export async function geocodePostalToLocation(postalOrAddress: string): Promise<GeocodeLocation | null> {
  const trimmed = postalOrAddress?.trim();
  if (!trimmed) return null;
  const wanted = isCompleteCanadianPostal(trimmed) ? compactPostal(trimmed) : null;
  const cacheKey = wanted ?? trimmed.toUpperCase();

  const fromCache = cachedGeo(cacheKey);
  if (fromCache) return fromCache;

  const existing = inflightGeo.get(cacheKey);
  if (existing) return existing;

  const work = (async (): Promise<GeocodeLocation | null> => {
    const accept = (loc: GeocodeLocation | null): GeocodeLocation | null => {
      if (!loc) return null;
      if (wanted && loc.postal) {
        const got = compactPostal(loc.postal);
        // Exact LDU mismatch → reject. FSA-only / null postal with coords is OK (Granby J2G*).
        if (got.length === 6 && got !== wanted) return null;
      }
      writeGeoCache(cacheKey, loc);
      if (wanted) writeGeoCache(wanted, loc);
      return loc;
    };

    // One short edge attempt for a full LDU. A hung geocode function must not eat the
    // make-request 18s budget before the FSA fallback runs.
    const viaEdge = accept(
      wanted ? (await geocodeViaEdgeOnce(trimmed, 8000)).loc : await geocodeViaEdge(trimmed),
    );
    if (viaEdge) return viaEdge;

    const viaClient = accept(await geocodeViaGoogleClient(trimmed));
    if (viaClient) return viaClient;

    // Exact LDU missed. FSA centroid only — never replace a successful exact hit.
    if (wanted && wanted.length === 6) {
      const fsa = wanted.slice(0, 3);
      const fsaLoc =
        accept(await geocodeViaZippopotamFsa(fsa)) ??
        accept((await geocodeViaEdgeOnce(fsa, 5000)).loc) ??
        accept(await geocodeViaGoogleClient(`${fsa}, Quebec, Canada`));
      if (fsaLoc) {
        const withWanted = { ...fsaLoc, postal: `${wanted.slice(0, 3)} ${wanted.slice(3)}` };
        writeGeoCache(cacheKey, withWanted);
        writeGeoCache(wanted, withWanted);
        return withWanted;
      }
    }

    return null;
  })();

  inflightGeo.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflightGeo.delete(cacheKey);
  }
}

/** True when both strings are the same Canadian LDU (ignores spaces/case). */
export function canadianPostalsEqual(a: string, b: string): boolean {
  const ca = compactPostal(a);
  const cb = compactPostal(b);
  return ca.length === 6 && ca === cb;
}

/** Extract a Canadian postal code from free text (e.g. pro profile address). */
export function extractCanadianPostal(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.toUpperCase().match(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

/** Haversine distance in km between two points */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

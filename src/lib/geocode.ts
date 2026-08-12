/**
 * Geocode via Supabase Edge Function (Google / geocoder.ca / Zippopotam),
 * with a direct Google client fallback when the edge call fails.
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
}

const CLIENT_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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

async function geocodeViaEdge(address: string): Promise<GeocodeLocation | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeLocation & { error?: string };
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    return {
      lat: data.lat,
      lng: data.lng,
      city: data.city ?? null,
      province: data.province ?? null,
      formattedAddress: data.formattedAddress,
    };
  } catch (err) {
    console.warn("Edge geocode error:", err);
    return null;
  }
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
      const res = await fetch(url);
      const data = (await res.json()) as { status: string; results?: GoogleResult[] };
      if (data.status !== "OK" || !data.results?.length) continue;

      let best = data.results[0];
      if (compact) {
        const exact = data.results.find((r) => postalFromComponents(r.address_components) === compact);
        if (exact) best = exact;
        else {
          const postalTyped = data.results.find((r) => r.types?.includes("postal_code"));
          if (postalTyped) best = postalTyped;
        }
      }

      const got = postalFromComponents(best.address_components);
      // Exact LDU only — approximate FSA hits share one pin for every code in H3Z*
      if (compact && got !== compact) continue;

      const parsed = parseGoogleResult(best);
      if (parsed) return parsed;
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
  if (!CLIENT_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CLIENT_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: { formatted_address?: string }[];
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    return data.results[0]?.formatted_address ?? null;
  } catch (err) {
    console.warn("Reverse geocode error:", err);
    return null;
  }
}

/**
 * Geocode postal/address.
 * Edge resolves full Canadian LDUs via geocoder.ca (then exact Google, then FSA fallback).
 */
export async function geocodePostalToLocation(postalOrAddress: string): Promise<GeocodeLocation | null> {
  const trimmed = postalOrAddress?.trim();
  if (!trimmed) return null;

  const viaEdge = await geocodeViaEdge(trimmed);
  if (viaEdge) return viaEdge;

  return geocodeViaGoogleClient(trimmed);
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

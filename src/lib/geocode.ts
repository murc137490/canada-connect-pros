/**
 * Geocode via Supabase Edge Function (Google Maps Geocoding API server-side),
 * with a direct Google client fallback when VITE_GOOGLE_* is set.
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

function normalizeQuery(address: string): { query: string; isCaPostal: boolean } {
  const trimmed = address.trim();
  const compact = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isCaPostal = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact);
  if (isCaPostal) {
    const spaced = `${compact.slice(0, 3)} ${compact.slice(3)}`;
    return { query: `${spaced}, Canada`, isCaPostal: true };
  }
  return { query: trimmed, isCaPostal: false };
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
  const { query, isCaPostal } = normalizeQuery(address);
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", CLIENT_KEY);
    url.searchParams.set("region", "ca");
    if (isCaPostal) url.searchParams.set("components", "country:CA");

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      results?: {
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      }[];
    };
    if (data.status !== "OK" || !data.results?.length) {
      console.warn("Google geocode status:", data.status);
      return null;
    }
    const first = data.results[0];
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

/** Geocode postal/address — edge function (Google) first, then client Google key. */
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

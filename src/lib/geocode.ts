/**
 * Geocode an address or postal code using Google Geocoding API.
 * Set VITE_GOOGLE_MAPS_API_KEY in .env for this to work.
 */
const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  if (!API_KEY) {
    console.warn("Google API key (VITE_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_PLACES_API_KEY) is not set; geocoding disabled.");
    return null;
  }
  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(trimmed)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[];
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const first = data.results[0];
    const loc = first?.geometry?.location;
    if (loc == null || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: first.formatted_address,
    };
  } catch (err) {
    console.warn("Geocode error:", err);
    return null;
  }
}

/**
 * Reverse geocode: get a formatted address from lat/lng using Google Geocoding API.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${API_KEY}`;
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

/** Geocode postal/address and return lat, lng, city, province for job requests */
export interface GeocodeLocation {
  lat: number;
  lng: number;
  city: string | null;
  province: string | null;
  formattedAddress?: string;
}

export async function geocodePostalToLocation(postalOrAddress: string): Promise<GeocodeLocation | null> {
  const result = await geocodeAddress(postalOrAddress);
  if (!result) return null;
  const trimmed = postalOrAddress?.trim();
  if (!trimmed || !API_KEY) return { lat: result.lat, lng: result.lng, city: null, province: null, formattedAddress: result.formattedAddress };
  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(trimmed)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: {
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      }[];
    };
    if (data.status !== "OK" || !data.results?.length) return { lat: result.lat, lng: result.lng, city: null, province: null, formattedAddress: result.formattedAddress };
    const first = data.results[0];
    const comps = first?.address_components ?? [];
    let city: string | null = null;
    let province: string | null = null;
    for (const c of comps) {
      if (c.types.includes("locality")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) province = c.short_name || c.long_name;
    }
    const loc = first?.geometry?.location;
    return {
      lat: loc?.lat ?? result.lat,
      lng: loc?.lng ?? result.lng,
      city,
      province,
      formattedAddress: first?.formatted_address ?? result.formattedAddress,
    };
  } catch {
    return { lat: result.lat, lng: result.lng, city: null, province: null, formattedAddress: result.formattedAddress };
  }
}

/** Haversine distance in km between two points */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

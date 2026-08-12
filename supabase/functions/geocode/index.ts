/**
 * Server-side geocode proxy.
 * Prefer Google when GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) is set.
 * Falls back to Zippopotam (Canadian FSA) so postals still resolve without a Google secret.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY =
  Deno.env.get("GOOGLE_MAPS_API_KEY") ||
  Deno.env.get("GOOGLE_PLACES_API_KEY") ||
  "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GeoOut = {
  lat: number;
  lng: number;
  city: string | null;
  province: string | null;
  formattedAddress: string | null;
};

function compactPostal(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeCanadianPostal(raw: string): string {
  const compact = compactPostal(raw);
  if (/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return raw.trim();
}

function isCaPostal(address: string): boolean {
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(
    address.replace(/\s+/g, " ").trim()
  );
}

async function geocodeGoogle(address: string): Promise<GeoOut | null> {
  if (!API_KEY) return null;
  const ca = isCaPostal(address);
  const query = ca && !/canada/i.test(address) ? `${address}, Canada` : address;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("region", "ca");
  if (ca) url.searchParams.set("components", "country:CA");

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    results?: {
      geometry?: { location?: { lat: number; lng: number } };
      formatted_address?: string;
      address_components?: { long_name: string; short_name: string; types: string[] }[];
    }[];
  };

  if (data.status !== "OK" || !data.results?.length) return null;
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
    formattedAddress: first.formatted_address ?? null,
  };
}

/** Canadian FSA (first 3 chars) via Zippopotam — reliable without API key. */
async function geocodeZippopotam(address: string): Promise<GeoOut | null> {
  const compact = compactPostal(address);
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]/.test(compact) || compact.length < 3) return null;
  const fsa = compact.slice(0, 3);

  const res = await fetch(`https://api.zippopotam.us/ca/${encodeURIComponent(fsa)}`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    places?: {
      "place name"?: string;
      latitude?: string;
      longitude?: string;
      state?: string;
      "state abbreviation"?: string;
    }[];
  };

  const place = data.places?.[0];
  if (!place?.latitude || !place?.longitude) return null;
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const city = place["place name"] ?? null;
  const province = place["state abbreviation"] || place.state || null;
  const spaced = compact.length >= 6 ? `${compact.slice(0, 3)} ${compact.slice(3, 6)}` : fsa;

  return {
    lat,
    lng,
    city,
    province,
    formattedAddress: [city, province, spaced, "Canada"].filter(Boolean).join(", "),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { address?: string };
    const address = normalizeCanadianPostal((body.address || "").toString());
    if (!address) {
      return new Response(JSON.stringify({ error: "missing address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viaGoogle = await geocodeGoogle(address);
    if (viaGoogle) {
      return new Response(JSON.stringify(viaGoogle), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viaZip = await geocodeZippopotam(address);
    if (viaZip) {
      return new Response(JSON.stringify(viaZip), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geocode error", e);
    return new Response(JSON.stringify({ error: "geocode_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

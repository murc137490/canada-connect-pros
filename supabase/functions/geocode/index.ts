/**
 * Server-side geocode proxy for Canadian postals.
 * Full LDU: geocoder.ca (retry) → Google exact postal match.
 * Never Zippopotam for 6-char LDUs (FSA centroid = same pin for every H3Z*).
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
  postal: string | null;
  source?: string;
};

type GoogleResult = {
  geometry?: { location?: { lat: number; lng: number } };
  formatted_address?: string;
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  types?: string[];
};

/** Short-lived LDU cache so geocoder.ca rate limits hurt less. */
const lduCache = new Map<string, { at: number; value: GeoOut }>();
const CACHE_MS = 1000 * 60 * 60 * 12;

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

function isFullCaPostal(address: string): boolean {
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(compactPostal(address));
}

function postalFromComponents(
  components: { long_name: string; short_name: string; types: string[] }[] | undefined
): string | null {
  for (const c of components ?? []) {
    if (c.types.includes("postal_code")) {
      return compactPostal(c.long_name || c.short_name);
    }
  }
  return null;
}

function parseGoogleResult(first: GoogleResult, postal: string | null): GeoOut | null {
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
    postal,
    source: "google",
  };
}

async function geocodeGoogle(address: string): Promise<GeoOut | null> {
  if (!API_KEY) return null;

  const fullCa = isFullCaPostal(address);
  const spaced = fullCa ? normalizeCanadianPostal(address) : address.trim();
  const wanted = fullCa ? compactPostal(address) : null;

  const attempts: URL[] = [];

  if (fullCa) {
    const byComponent = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    byComponent.searchParams.set("components", `postal_code:${spaced}|country:CA`);
    byComponent.searchParams.set("key", API_KEY);
    byComponent.searchParams.set("region", "ca");
    attempts.push(byComponent);
  }

  const byAddress = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  byAddress.searchParams.set("address", fullCa ? `${spaced}, Canada` : spaced);
  byAddress.searchParams.set("key", API_KEY);
  byAddress.searchParams.set("region", "ca");
  if (fullCa) byAddress.searchParams.set("components", "country:CA");
  attempts.push(byAddress);

  for (const url of attempts) {
    const res = await fetch(url.toString());
    const data = (await res.json()) as { status: string; results?: GoogleResult[] };
    if (data.status !== "OK" || !data.results?.length) continue;

    const exact = wanted
      ? data.results.find((r) => postalFromComponents(r.address_components) === wanted)
      : data.results[0];
    if (!exact) continue;

    const got = postalFromComponents(exact.address_components);
    if (wanted && got !== wanted) continue;

    const parsed = parseGoogleResult(exact, wanted ? normalizeCanadianPostal(wanted) : null);
    if (parsed) return parsed;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Full 6-char Canadian postal (LDU). */
async function geocodeGeocoderCa(address: string): Promise<GeoOut | null> {
  if (!isFullCaPostal(address)) return null;
  const spaced = normalizeCanadianPostal(address);
  const compact = compactPostal(address);

  const cached = lduCache.get(compact);
  if (cached && Date.now() - cached.at < CACHE_MS) return { ...cached.value, source: "cache" };

  const urls = [
    `https://geocoder.ca/?locate=${encodeURIComponent(spaced)}&geoit=XML&json=1`,
    `https://geocoder.ca/?locate=${encodeURIComponent(compact)}&geoit=XML&json=1`,
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(600);
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "PremiereServices/1.0 (geocode)", Accept: "application/json" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          latt?: string | number;
          longt?: string | number;
          error?: { code?: string; message?: string } | string;
          postal?: string;
          standard?: { city?: string; prov?: string };
          success?: boolean;
        };

        const errMsg =
          typeof data.error === "object" && data.error
            ? String(data.error.message || data.error.code || "")
            : typeof data.error === "string"
              ? data.error
              : "";
        if (/throttl|rate limit/i.test(errMsg)) {
          await sleep(700);
          continue;
        }
        if (data.error || data.latt == null || data.longt == null) continue;

        const lat = Number(data.latt);
        const lng = Number(data.longt);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const returned = data.postal ? compactPostal(String(data.postal)) : null;
        if (returned && returned.length === 6 && returned !== compact) continue;

        const city = data.standard?.city ?? null;
        const province = data.standard?.prov ?? null;
        const out: GeoOut = {
          lat,
          lng,
          city,
          province,
          formattedAddress: [city, province, spaced, "Canada"].filter(Boolean).join(", "),
          postal: spaced,
          source: "geocoder.ca",
        };
        lduCache.set(compact, { at: Date.now(), value: out });
        return out;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/** FSA-only (3 chars). Do not use for full LDUs. */
async function geocodeZippopotamFsa(address: string): Promise<GeoOut | null> {
  const compact = compactPostal(address);
  // Only when caller asked for FSA / incomplete postal — never for full LDU
  if (compact.length !== 3) return null;
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]$/.test(compact)) return null;

  const res = await fetch(`https://api.zippopotam.us/ca/${encodeURIComponent(compact)}`);
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

  return {
    lat,
    lng,
    city,
    province,
    formattedAddress: [city, province, compact, "Canada"].filter(Boolean).join(", "),
    postal: compact,
    source: "zippopotam",
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

    if (isFullCaPostal(address)) {
      const viaGeocoderCa = await geocodeGeocoderCa(address);
      if (viaGeocoderCa) {
        return new Response(JSON.stringify(viaGeocoderCa), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const viaGoogle = await geocodeGoogle(address);
      if (viaGoogle) {
        return new Response(JSON.stringify(viaGoogle), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Do NOT Zippopotam full LDUs — that returns one FSA pin (looks like H3Z 1A1 for all H3Z*).
      return new Response(JSON.stringify({ error: "not_found", reason: "ldu_unresolved" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viaGoogle = await geocodeGoogle(address);
    if (viaGoogle) {
      return new Response(JSON.stringify(viaGoogle), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viaZip = await geocodeZippopotamFsa(address);
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

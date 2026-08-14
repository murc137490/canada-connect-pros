/**
 * Server-side geocode proxy for Canadian postals.
 * Full LDU: Google (exact / formatted match) → geocoder.ca (retry on throttle) → Photon exact postcode.
 * Never Zippopotam for 6-char LDUs (FSA centroid = same pin for every H3Z*).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY =
  Deno.env.get("GOOGLE_MAPS_API_KEY") ||
  Deno.env.get("GOOGLE_PLACES_API_KEY") ||
  "";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

async function readDbCache(compact: string): Promise<GeoOut | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/geocode_cache?postal=eq.${encodeURIComponent(compact)}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      postal: string;
      lat: number;
      lng: number;
      city: string | null;
      province: string | null;
      formatted_address: string | null;
      source: string | null;
    }[];
    const row = rows[0];
    if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null;
    const spaced = normalizeCanadianPostal(compact);
    return {
      lat: row.lat,
      lng: row.lng,
      city: row.city,
      province: row.province,
      formattedAddress: row.formatted_address ?? [row.city, row.province, spaced, "Canada"].filter(Boolean).join(", "),
      postal: spaced,
      source: row.source ? `db:${row.source}` : "db",
    };
  } catch {
    return null;
  }
}

async function writeDbCache(compact: string, value: GeoOut): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/geocode_cache`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        postal: compact,
        lat: value.lat,
        lng: value.lng,
        city: value.city,
        province: value.province,
        formatted_address: value.formattedAddress,
        source: value.source ?? "edge",
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* non-fatal */
  }
}

function remember(compact: string, value: GeoOut): GeoOut {
  lduCache.set(compact, { at: Date.now(), value });
  void writeDbCache(compact, value);
  return value;
}

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

/** True when Google result is the requested LDU (not just the FSA centroid). */
function googleMatchesLdu(result: GoogleResult, wanted: string): boolean {
  const got = postalFromComponents(result.address_components);
  if (got === wanted) return true;
  // Reject a different full LDU (e.g. nearby code).
  if (got && got.length === 6 && got !== wanted) return false;

  const formatted = (result.formatted_address || "").toUpperCase();
  const spaced = `${wanted.slice(0, 3)} ${wanted.slice(3)}`;
  if (formatted.includes(spaced) || formatted.replace(/\s+/g, "").includes(wanted)) return true;

  return false;
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
      ? data.results.find((r) => googleMatchesLdu(r, wanted))
      : data.results[0];
    if (!exact) continue;

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
    `https://geocoder.ca/${encodeURIComponent(spaced)}?json=1`,
    `https://geocoder.ca/${encodeURIComponent(compact)}?json=1`,
  ];

  let throttled = false;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(throttled ? 900 * attempt : 450 * attempt);
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "PremiereServices/1.0 (geocode)", Accept: "application/json" },
        });
        const data = (await res.json().catch(() => null)) as {
          latt?: string | number;
          longt?: string | number;
          error?: { code?: string; message?: string } | string;
          postal?: string;
          standard?: { city?: string; prov?: string };
          success?: boolean;
        } | null;
        if (!data) continue;

        const errMsg =
          typeof data.error === "object" && data.error
            ? String(data.error.message || data.error.code || "")
            : typeof data.error === "string"
              ? data.error
              : "";
        if (/throttl|rate limit/i.test(errMsg)) {
          throttled = true;
          await sleep(800);
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
        return remember(compact, out);
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/** Photon OSM — only accept an exact postcode name match (avoids H3X/H3S fuzzy hits). */
async function geocodePhotonExact(address: string): Promise<GeoOut | null> {
  if (!isFullCaPostal(address)) return null;
  const spaced = normalizeCanadianPostal(address);
  const compact = compactPostal(address);

  const urls = [
    `https://photon.komoot.io/api/?q=${encodeURIComponent(spaced)}&limit=8&lang=en`,
    `https://photon.komoot.io/api/?q=${encodeURIComponent(`${spaced}, Canada`)}&limit=8&lang=en`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "PremiereServices/1.0 (geocode)" },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        features?: {
          geometry?: { coordinates?: number[] };
          properties?: {
            name?: string;
            city?: string;
            state?: string;
            countrycode?: string;
            osm_value?: string;
          };
        }[];
      };

      for (const f of data.features ?? []) {
        const name = compactPostal(f.properties?.name || "");
        if (name !== compact) continue;
        if (f.properties?.countrycode && f.properties.countrycode.toUpperCase() !== "CA") continue;
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const city = f.properties?.city ?? null;
        const province = f.properties?.state ?? null;
        const out: GeoOut = {
          lat,
          lng,
          city,
          province,
          formattedAddress: [city, province, spaced, "Canada"].filter(Boolean).join(", "),
          postal: spaced,
          source: "photon",
        };
        return remember(compact, out);
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** FSA-only (3 chars). Do not use for full LDUs. */
async function geocodeZippopotamFsa(address: string): Promise<GeoOut | null> {
  const compact = compactPostal(address);
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
      const compact = compactPostal(address);
      const mem = lduCache.get(compact);
      if (mem && Date.now() - mem.at < CACHE_MS) {
        return new Response(JSON.stringify({ ...mem.value, source: "cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fromDb = await readDbCache(compact);
      if (fromDb) {
        lduCache.set(compact, { at: Date.now(), value: fromDb });
        return new Response(JSON.stringify(fromDb), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Google first when keyed — more reliable than free geocoder.ca under load.
      const viaGoogle = await geocodeGoogle(address);
      if (viaGoogle) {
        remember(compact, viaGoogle);
        return new Response(JSON.stringify(viaGoogle), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const viaGeocoderCa = await geocodeGeocoderCa(address);
      if (viaGeocoderCa) {
        return new Response(JSON.stringify(viaGeocoderCa), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const viaPhoton = await geocodePhotonExact(address);
      if (viaPhoton) {
        return new Response(JSON.stringify(viaPhoton), {
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

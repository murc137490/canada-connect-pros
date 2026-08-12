/**
 * Server-side Google Geocoding proxy (keeps API key off the client).
 * Secret: GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY)
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

function normalizeCanadianPostal(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return raw.trim();
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

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Geocoding not configured" }), {
      status: 503,
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

    const looksLikeCaPostal = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(
      address.replace(/\s+/g, " ").trim()
    );
    const query = looksLikeCaPostal && !/canada/i.test(address) ? `${address}, Canada` : address;

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("region", "ca");
    if (looksLikeCaPostal) url.searchParams.set("components", "country:CA");

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: {
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      }[];
    };

    if (data.status !== "OK" || !data.results?.length) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          status: data.status,
          details: data.error_message || null,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const first = data.results[0];
    const loc = first?.geometry?.location;
    if (loc == null || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let city: string | null = null;
    let province: string | null = null;
    for (const c of first.address_components ?? []) {
      if (!city && (c.types.includes("locality") || c.types.includes("postal_town"))) city = c.long_name;
      if (!city && c.types.includes("sublocality")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) province = c.short_name || c.long_name;
    }

    return new Response(
      JSON.stringify({
        lat: loc.lat,
        lng: loc.lng,
        city,
        province,
        formattedAddress: first.formatted_address ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("geocode error", e);
    return new Response(JSON.stringify({ error: "geocode_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

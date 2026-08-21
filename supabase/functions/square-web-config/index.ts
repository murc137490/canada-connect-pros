import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Public Square Web Payments config for the browser SDK.
 * Application ID + Location ID are safe to expose (same as VITE_* vars).
 * Never returns access tokens.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const applicationId = (
    Deno.env.get("SQUARE_APPLICATION_ID") ??
    Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ??
    ""
  ).trim();
  const locationId = (Deno.env.get("SQUARE_LOCATION_ID") ?? "").trim();
  // Prefer explicit secret; otherwise infer from application id prefix.
  const envSecret = (Deno.env.get("SQUARE_ENVIRONMENT") ?? "").trim().toLowerCase();
  const environment =
    envSecret === "production" || (!envSecret && applicationId.startsWith("sq0idp-"))
      ? "production"
      : "sandbox";

  if (!applicationId || !locationId) {
    return new Response(
      JSON.stringify({
        configured: false,
        application_id: null,
        location_id: null,
        environment,
        error: "Square web config incomplete",
        details:
          "Set SQUARE_APPLICATION_ID (or SQUARE_OAUTH_APPLICATION_ID) and SQUARE_LOCATION_ID on Edge Function secrets.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      configured: true,
      application_id: applicationId,
      location_id: locationId,
      environment,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

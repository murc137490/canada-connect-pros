import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Diagnose + register Apple Pay domain via Square RegisterDomain API.
 * Returns Square's real error detail (expected vs actual bytes).
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

  const url = new URL(req.url);
  const domain =
    (url.searchParams.get("domain") ?? "www.premiereservices.ca").trim() ||
    "www.premiereservices.ca";
  const fileUrl = `https://${domain}/.well-known/apple-developer-merchantid-domain-association`;

  let probe: Record<string, unknown> = {};
  try {
    const res = await fetch(fileUrl, {
      headers: { "User-Agent": "Go-http-client/1.1", Accept: "*/*" },
      redirect: "manual",
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const text = new TextDecoder().decode(buf);
    probe = {
      status: res.status,
      location: res.headers.get("location"),
      content_length_header: res.headers.get("content-length"),
      content_type: res.headers.get("content-type"),
      content_disposition: res.headers.get("content-disposition"),
      accept_ranges: res.headers.get("accept-ranges"),
      transfer_encoding: res.headers.get("transfer-encoding"),
      body_bytes: buf.byteLength,
      starts_with_hex: /^[0-9A-Fa-f]/.test(text),
      starts_with_json: text.startsWith("{"),
      preview: text.slice(0, 40),
    };
  } catch (e) {
    probe = { error: String(e) };
  }

  const accessToken = (Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "").trim();
  const environment =
    Deno.env.get("SQUARE_ENVIRONMENT") === "production" ? "production" : "sandbox";
  const squareBase =
    environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

  let square: Record<string, unknown> = { skipped: true, reason: "SQUARE_ACCESS_TOKEN missing" };

  if (accessToken) {
    try {
      const sqRes = await fetch(`${squareBase}/v2/apple-pay/domains`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-12-18",
        },
        body: JSON.stringify({ domain_name: domain }),
      });
      const sqJson = await sqRes.json();
      square = { http_status: sqRes.status, environment, response: sqJson };
    } catch (e) {
      square = { error: String(e), environment };
    }
  }

  return new Response(JSON.stringify({ domain, fileUrl, probe, square }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

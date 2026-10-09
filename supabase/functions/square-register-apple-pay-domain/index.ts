import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callerIsPlatformModerator } from "../_shared/platformAdmin.ts";

/**
 * Diagnose + register Apple Pay domain via Square RegisterDomain API.
 * Returns Square's real error detail (expected vs actual bytes).
 * Platform admins only (super admin or profiles.is_platform_admin): send the admin's session
 * token as `Authorization: Bearer <access_token>`. Anyone else gets 401/403 before any probe or
 * Square call. One-time setup tool; the app has no button for it.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(withCorsAllowlist(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return deny(401, "Unauthorized");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return deny(500, "Server misconfigured");
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return deny(401, "Unauthorized");
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  if (!(await callerIsPlatformModerator(adminClient, user.id, user.email))) return deny(403, "Forbidden: admin only");

  const url = new URL(req.url);
  const domain =
    (url.searchParams.get("domain") ?? "www.altshift.ca").trim() ||
    "www.altshift.ca";
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
      x_assoc_rev: res.headers.get("x-assoc-rev"),
      x_assoc_bytes: res.headers.get("x-assoc-bytes"),
      body_bytes: buf.byteLength,
      starts_with_hex: /^[0-9A-Fa-f]+$/.test(text.trim()),
      starts_with_json: text.trimStart().startsWith("{"),
      preview: text.slice(0, 40),
      ok_for_square: buf.byteLength === 9098 && /^[0-9A-Fa-f]+$/.test(text.trim()),
    };
  } catch (e) {
    probe = { error: String(e) };
  }

  const accessToken = (Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "").trim();
  const envParam = (url.searchParams.get("env") ?? "").trim().toLowerCase();
  const environment =
    envParam === "production" || envParam === "sandbox"
      ? envParam
      : Deno.env.get("SQUARE_ENVIRONMENT") === "production"
      ? "production"
      : "sandbox";
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
}));

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = "https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/zoho-oauth-callback";
const ADMIN_RETURN = "https://www.altshift.ca/dashboard?tab=recruitment";
const MAILBOX_HINT = "aymen@altshift.ca";
const SCOPES = ["ZohoMail.accounts.READ", "ZohoMail.messages.READ", "ZohoMail.messages.CREATE"];
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function allowedOrigin(origin: string): string {
  return /^https:\/\/(www\.)?altshift\.ca$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)
    ? origin
    : "https://www.altshift.ca";
}

function json(body: unknown, status = 200, origin = "https://www.altshift.ca"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("Origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server unavailable" }, 503, origin);

  const authorization = req.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "Unauthorized" }, 401, origin);

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !user) return json({ error: "Unauthorized" }, 401, origin);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await adminClient.from("profiles").select("is_platform_admin").eq("user_id", user.id).maybeSingle();
  const adminEmail = (user.email ?? "").trim().toLowerCase();
  if (profile?.is_platform_admin !== true && !["murc137490@gmail.com", "premiereservicescontact@gmail.com", "grokistgutgenug@gmail.com"].includes(adminEmail)) {
    return json({ error: "Forbidden" }, 403, origin);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400, origin); }
  const action = body.action;

  if (action === "status") {
    const { data, error } = await adminClient.rpc("zoho_oauth_connection_status");
    if (error) return json({ error: "Unable to check the Zoho connection" }, 500, origin);
    return json(data ?? { connected: false }, 200, origin);
  }

  if (action !== "start") return json({ error: "Unknown action" }, 400, origin);
  const clientId = Deno.env.get("ZOHO_CLIENT_ID")?.trim();
  if (!clientId || !Deno.env.get("ZOHO_CLIENT_SECRET")?.trim()) return json({ error: "Zoho OAuth credentials are not configured" }, 503, origin);

  const rawState = new Uint8Array(32);
  crypto.getRandomValues(rawState);
  const state = bytesToBase64Url(rawState);
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: stateError } = await adminClient.rpc("zoho_oauth_create_state", {
    p_state_hash: stateHash,
    p_initiated_by: user.id,
    p_data_center: "ca",
    p_accounts_server: "https://accounts.zohocloud.ca",
    p_mailbox_hint: MAILBOX_HINT,
    p_expires_at: expiresAt,
  });
  if (stateError) return json({ error: "Unable to start Zoho authorization" }, 503, origin);

  const authorize = new URL("https://accounts.zohocloud.ca/oauth/v2/auth");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", REDIRECT_URI);
  authorize.searchParams.set("scope", SCOPES.join(","));
  authorize.searchParams.set("access_type", "offline");
  authorize.searchParams.set("prompt", "consent");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("login_hint", MAILBOX_HINT);
  return json({ authorize_url: authorize.toString(), redirect_uri: REDIRECT_URI, expires_in_seconds: 600 }, 200, origin);
});

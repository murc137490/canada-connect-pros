// Returns Square OAuth authorize URL for the signed-in pro (Connect Square).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function squareConnectHost(): string {
  return Deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256B64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return bytesToBase64Url(sig);
}

async function buildOAuthState(args: {
  proProfileId: string;
  userId: string;
  secret: string;
  ttlMs: number;
}): Promise<string> {
  const exp = Date.now() + args.ttlMs;
  const payload = JSON.stringify({ p: args.proProfileId, u: args.userId, exp });
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payload));
  const sig = await hmacSha256B64Url(args.secret, payloadB64);
  return `${payloadB64}.${sig}`;
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized", details: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientId = (Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ?? Deno.env.get("SQUARE_APPLICATION_ID") ?? "").trim();
  const stateSecret = (Deno.env.get("SQUARE_OAUTH_STATE_SECRET") ?? "").trim();
  if (!clientId || !stateSecret) {
    return new Response(
      JSON.stringify({
        error: "Square OAuth not configured",
        details: "Set SQUARE_OAUTH_APPLICATION_ID and SQUARE_OAUTH_STATE_SECRET on this function.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let proProfileId = "";
  try {
    const body = await req.json().catch(() => ({}));
    proProfileId = typeof body.pro_profile_id === "string" ? body.pro_profile_id.trim() : "";
  } catch {
    /* ignore */
  }
  if (!proProfileId) {
    return new Response(JSON.stringify({ error: "Invalid request", details: "pro_profile_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: proRow, error: proErr } = await userClient
    .from("pro_profiles")
    .select("id, user_id, is_verified")
    .eq("id", proProfileId)
    .maybeSingle();
  if (proErr || !proRow || proRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden", details: "Not your pro profile" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (proRow.is_verified !== true) {
    return new Response(JSON.stringify({ error: "Forbidden", details: "Pro profile must be verified" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const redirectBase = supabaseUrl.replace(/\/+$/, "");
  const redirectUri = `${redirectBase}/functions/v1/square-oauth-callback`;

  const state = await buildOAuthState({
    proProfileId,
    userId: user.id,
    secret: stateSecret,
    ttlMs: 15 * 60 * 1000,
  });

  const scopes = [
    "MERCHANT_PROFILE_READ",
    "PAYMENTS_READ",
    "PAYMENTS_WRITE",
  ].join(" ");

  const authUrl = new URL(`${squareConnectHost()}/oauth2/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("session", "false");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return new Response(JSON.stringify({ authorize_url: authUrl.toString(), redirect_uri: redirectUri }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

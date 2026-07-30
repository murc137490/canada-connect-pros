// Square OAuth redirect: exchange code, store tokens, pick a location, redirect back to the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function squareConnectHost(): string {
  return Deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function squareApiHost(): string {
  return Deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function siteOrigin(): string {
  const raw = (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "").trim();
  if (raw) {
    try {
      return trimSlash(new URL(raw.includes("://") ? raw : `https://${raw}`).origin);
    } catch {
      /* fall through */
    }
  }
  return "https://www.premiereservices.ca";
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

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function base64UrlToUtf8(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const std = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function verifyState(state: string, secret: string): Promise<{ p: string; u: string } | null> {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = await hmacSha256B64Url(secret, payloadB64);
  if (!timingSafeEqualStr(sig, expected)) return null;
  let parsed: { p?: string; u?: string; exp?: number };
  try {
    parsed = JSON.parse(base64UrlToUtf8(payloadB64)) as { p?: string; u?: string; exp?: number };
  } catch {
    return null;
  }
  if (typeof parsed.p !== "string" || typeof parsed.u !== "string" || typeof parsed.exp !== "number") return null;
  if (Date.now() > parsed.exp) return null;
  return { p: parsed.p, u: parsed.u };
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const redirectBase = trimSlash(supabaseUrl);
  const redirectUri = `${redirectBase}/functions/v1/square-oauth-callback`;
  const appDash = `${siteOrigin()}/dashboard?tab=pro`;

  const fail = (code: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${appDash}&square_error=${encodeURIComponent(code)}` },
    });

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) {
    return fail(url.searchParams.get("error_description")?.slice(0, 200) ?? err);
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  if (!code || !state) {
    return fail("missing_code_or_state");
  }

  const stateSecret = (Deno.env.get("SQUARE_OAUTH_STATE_SECRET") ?? "").trim();
  if (!stateSecret) {
    return fail("server_misconfigured_state");
  }

  const verified = await verifyState(state, stateSecret);
  if (!verified) {
    return fail("invalid_state");
  }

  const clientId = (Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ?? Deno.env.get("SQUARE_APPLICATION_ID") ?? "").trim();
  const clientSecret = (Deno.env.get("SQUARE_OAUTH_APPLICATION_SECRET") ?? "").trim();
  if (!clientId || !clientSecret) {
    return fail("server_misconfigured_oauth");
  }

  const tokenHost = squareConnectHost();
  const tokenRes = await fetch(`${tokenHost}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!tokenRes.ok) {
    const detail =
      (Array.isArray(tokenJson.errors) && (tokenJson.errors as { detail?: string }[])[0]?.detail) ||
      (typeof tokenJson.message === "string" ? tokenJson.message : "token_exchange_failed");
    return fail(String(detail).slice(0, 180));
  }

  const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
  const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : "";
  const merchantId = typeof tokenJson.merchant_id === "string" ? tokenJson.merchant_id : "";
  const expiresAtRaw = tokenJson.expires_at;
  let expiresAt: string | null = null;
  if (typeof expiresAtRaw === "string") {
    expiresAt = expiresAtRaw;
  } else if (typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)) {
    expiresAt = new Date(expiresAtRaw).toISOString();
  }

  if (!accessToken || !merchantId) {
    return fail("invalid_token_response");
  }

  const apiBase = squareApiHost();
  const locRes = await fetch(`${apiBase}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
  });
  const locJson = (await locRes.json().catch(() => ({}))) as { locations?: { id?: string; status?: string }[] };
  const locations = Array.isArray(locJson.locations) ? locJson.locations : [];
  const active = locations.find((l) => String(l.status ?? "").toUpperCase() === "ACTIVE") ?? locations[0];
  const locationId = typeof active?.id === "string" ? active.id : "";
  if (!locationId) {
    return fail("no_square_location");
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || !supabaseUrl) {
    return fail("server_misconfigured_db");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: proRow, error: proErr } = await admin
    .from("pro_profiles")
    .select("id, user_id")
    .eq("id", verified.p)
    .maybeSingle();
  if (proErr || !proRow || proRow.user_id !== verified.u) {
    return fail("pro_mismatch");
  }

  const { error: upsertErr } = await admin.from("pro_square_tokens").upsert(
    {
      pro_profile_id: verified.p,
      merchant_id: merchantId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "pro_profile_id" }
  );
  if (upsertErr) {
    return fail("db_token_save");
  }

  const { error: locErr } = await admin
    .from("pro_profiles")
    .update({ square_location_id: locationId, updated_at: new Date().toISOString() })
    .eq("id", verified.p);
  if (locErr) {
    return fail("db_location_save");
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${appDash}&square_connected=1` },
  });
});

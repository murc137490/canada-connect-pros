import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = "https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/zoho-oauth-callback";
const ADMIN_RETURN = "https://www.altshift.ca/dashboard?tab=recruitment";
const EXPECTED_SCOPES = ["ZohoMail.accounts.READ", "ZohoMail.messages.READ", "ZohoMail.messages.CREATE"];
const DATA_CENTERS: Record<string, { accounts: string; mail: string }> = {
  us: { accounts: "https://accounts.zoho.com", mail: "https://mail.zoho.com" },
  eu: { accounts: "https://accounts.zoho.eu", mail: "https://mail.zoho.eu" },
  in: { accounts: "https://accounts.zoho.in", mail: "https://mail.zoho.in" },
  au: { accounts: "https://accounts.zoho.com.au", mail: "https://mail.zoho.com.au" },
  jp: { accounts: "https://accounts.zoho.jp", mail: "https://mail.zoho.jp" },
  cn: { accounts: "https://accounts.zoho.com.cn", mail: "https://mail.zoho.com.cn" },
  ca: { accounts: "https://accounts.zohocloud.ca", mail: "https://mail.zohocloud.ca" },
  ae: { accounts: "https://accounts.zoho.ae", mail: "https://mail.zoho.ae" },
  sa: { accounts: "https://accounts.zoho.sa", mail: "https://mail.zoho.sa" },
};

function redirect(result: string): Response {
  const target = new URL(ADMIN_RETURN);
  target.searchParams.set("zoho", result);
  return new Response(null, { status: 303, headers: { Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveDataCenter(location: string | null, accountsServer: string | null, fallback: string) {
  const normalizedLocation = location?.trim().toLowerCase() || null;
  if (accountsServer) {
    try {
    const provided = new URL(accountsServer);
    if (provided.protocol !== "https:" || provided.username || provided.password || provided.port || provided.pathname !== "/" || provided.search || provided.hash) return null;
    const match = Object.entries(DATA_CENTERS).find(([, endpoints]) => endpoints.accounts === provided.origin);
      if (!match || (normalizedLocation && match[0] !== normalizedLocation)) return null;
      return { location: match[0], ...match[1] };
    } catch {
      return null;
    }
  }
  const effectiveLocation = normalizedLocation || fallback.trim().toLowerCase();
  const endpoint = DATA_CENTERS[effectiveLocation];
  return endpoint ? { location: effectiveLocation, ...endpoint } : null;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "";
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(state)) return redirect("invalid_state");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return redirect("unavailable");
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: stateRows, error: consumeError } = await db.rpc("zoho_oauth_consume_state", { p_state_hash: await sha256Hex(state) });
  const oauthState = Array.isArray(stateRows) ? stateRows[0] : null;
  if (consumeError) return redirect("unavailable");
  if (!oauthState?.initiated_by || !oauthState?.data_center) return redirect("invalid_state");

  if (params.has("error")) return redirect("access_denied");
  const code = params.get("code") ?? "";
  if (!code || code.length > 2048) return redirect("missing_code");

  const region = resolveDataCenter(params.get("location"), params.get("accounts-server"), String(oauthState.data_center));
  if (!region) return redirect("invalid_region");

  const clientId = Deno.env.get("ZOHO_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) return redirect("not_configured");

  const tokenBody = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    scope: EXPECTED_SCOPES.join(","),
  });
  let tokenData: Record<string, unknown>;
  try {
    const tokenResponse = await fetch(`${region.accounts}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenBody,
      redirect: "error",
    });
    if (!tokenResponse.ok) return redirect("authorization_failed");
    tokenData = await tokenResponse.json() as Record<string, unknown>;
  } catch {
    return redirect("authorization_failed");
  }

  const refreshToken = typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : "";
  if (!refreshToken) return redirect("refresh_token_missing");
  const returnedScopes = typeof tokenData.scope === "string"
    ? tokenData.scope.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean)
    : EXPECTED_SCOPES;

  const { error: storeError } = await db.rpc("zoho_oauth_store_connection", {
    p_refresh_token: refreshToken,
    p_data_center: region.location,
    p_accounts_server: region.accounts,
    p_mail_api_domain: region.mail,
    p_mailbox_hint: String(oauthState.mailbox_hint ?? "aymen@altshift.ca"),
    p_granted_scopes: returnedScopes,
    p_connected_by: oauthState.initiated_by,
  });
  if (storeError) return redirect("storage_failed");
  return redirect("connected");
});

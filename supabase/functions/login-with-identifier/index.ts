/**
 * Password login by Member ID or username.
 *
 * POST { identifier, password } →
 *   200 { access_token, refresh_token, expires_in, expires_at, token_type }
 *   401 { error: "invalid_credentials", hint? }   (unknown ID, wrong password, ambiguous username…)
 *   403 { error: "email_not_confirmed" }          (only after a CORRECT password)
 *   429 { error: "too_many_attempts" }
 *
 * - The email is resolved server-side with the service role and NEVER returned.
 * - Responses do not reveal whether an identifier exists (same body + timing floor).
 * - Per-identifier and per-IP throttling via public.login_attempts (HMAC hashes only).
 * - CORS: altshift.ca / www.altshift.ca, localhost for dev, plus LOGIN_ALLOWED_ORIGINS.
 *
 * Secrets (env only): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * optional LOGIN_THROTTLE_PEPPER, optional LOGIN_ALLOWED_ORIGINS (comma-separated).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEMBER_ID_RE = /^\d{4,5}$/;
const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

const WINDOW_SECONDS = 15 * 60;
const MAX_IDENTIFIER_FAILURES = 8;
const MAX_IP_FAILURES = 20;
const MAX_IP_ATTEMPTS = 60;
const MIN_FAILURE_MS = 650;

const BASE_ALLOWED_ORIGINS = new Set([
  "https://altshift.ca",
  "https://www.altshift.ca",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (BASE_ALLOWED_ORIGINS.has(origin)) return true;
  const extra = (Deno.env.get("LOGIN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (extra.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      (u.protocol === "http:" || u.protocol === "https:");
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(origin: string | null, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keep failure responses at a similar duration whether or not the identifier exists. */
async function padFailure(startedAt: number) {
  const target = MIN_FAILURE_MS + Math.floor(Math.random() * 200);
  const elapsed = Date.now() - startedAt;
  if (elapsed < target) await sleep(target - elapsed);
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() ||
    "unknown";
}

async function hmacHex(key: string, value: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Normalized = { kind: "member_id" | "username"; value: string } | null;

export function normalizeIdentifier(raw: unknown): Normalized {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64) return null;
  // Allow "#1234", "1234 " or "12 34" for Member IDs.
  const digits = trimmed.replace(/[\s#-]/g, "");
  if (/^\d+$/.test(digits)) return MEMBER_ID_RE.test(digits) ? { kind: "member_id", value: digits } : null;
  const username = trimmed.replace(/^@/, "").toLowerCase();
  return USERNAME_RE.test(username) ? { kind: "username", value: username } : null;
}

/** Returns the user id only when exactly one account matches. */
async function resolveUserId(admin: SupabaseClient, id: NonNullable<Normalized>): Promise<string | null> {
  const query = admin.from("profiles").select("user_id").limit(2);
  const { data, error } = id.kind === "member_id"
    ? await query.eq("public_user_number", id.value)
    : await query.eq("username", id.value);
  if (error) {
    // e.g. username column not migrated yet — treat as not found, never as a server error to the client.
    console.error("login resolve failed", id.kind, error.code ?? "db_error");
    return null;
  }
  if (!data || data.length !== 1) return null; // none, or ambiguous → never sign anyone in
  return String(data[0].user_id);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: isAllowedOrigin(origin) ? 204 : 403, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json(origin, { error: "method_not_allowed" }, 405);
  // Browsers always send Origin on cross-origin POST; refuse unknown sites.
  if (origin && !isAllowedOrigin(origin)) return json(origin, { error: "origin_not_allowed" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("login-with-identifier misconfigured");
    return json(origin, { error: "server_misconfigured" }, 500);
  }

  const startedAt = Date.now();
  const body = await req.json().catch(() => ({})) as { identifier?: unknown; password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const id = normalizeIdentifier(body.identifier);
  const hint = id?.kind === "member_id" ? undefined : "try_member_id";

  const invalid = async () => {
    await padFailure(startedAt);
    return json(origin, { error: "invalid_credentials", ...(hint ? { hint } : {}) }, 401);
  };

  if (!id || password.length < 1 || password.length > 256) return await invalid();

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pepper = Deno.env.get("LOGIN_THROTTLE_PEPPER")?.trim() || serviceKey;
  const [ipHash, identifierHash] = await Promise.all([
    hmacHex(pepper, `ip:${clientIp(req)}`),
    hmacHex(pepper, `id:${id.kind}:${id.value}`),
  ]);

  // Throttle (fails open if the migration is not applied yet, but logs it).
  let throttleAvailable = true;
  try {
    const { data, error } = await admin.rpc("login_throttle_check", {
      p_ip_hash: ipHash,
      p_identifier_hash: identifierHash,
      p_window_seconds: WINDOW_SECONDS,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { ip_attempts?: number; ip_failures?: number; identifier_failures?: number }
      | null;
    if (
      (row?.identifier_failures ?? 0) >= MAX_IDENTIFIER_FAILURES ||
      (row?.ip_failures ?? 0) >= MAX_IP_FAILURES ||
      (row?.ip_attempts ?? 0) >= MAX_IP_ATTEMPTS
    ) {
      await padFailure(startedAt);
      return json(origin, { error: "too_many_attempts" }, 429);
    }
  } catch (e) {
    throttleAvailable = false;
    console.error("login throttle unavailable", (e as { code?: string })?.code ?? "error");
  }

  const record = async (success: boolean) => {
    if (!throttleAvailable) return;
    const { error } = await admin.rpc("login_throttle_record", {
      p_ip_hash: ipHash,
      p_identifier_hash: identifierHash,
      p_success: success,
    });
    if (error) console.error("login throttle record failed", error.code ?? "error");
  };

  try {
    const userId = await resolveUserId(admin, id);
    let email: string | null = null;
    if (userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (!error) email = data.user?.email?.trim() || null;
    }
    if (!email) {
      await record(false);
      return await invalid();
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    email = null;

    if (error || !data.session) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (code === "email_not_confirmed" || /email not confirmed/i.test(error?.message ?? "")) {
        // Supabase only reports this after the password matched.
        await record(true);
        return json(origin, { error: "email_not_confirmed" }, 403);
      }
      if ((error as { status?: number } | null)?.status === 429) {
        console.error("login upstream rate limited");
        await padFailure(startedAt);
        return json(origin, { error: "too_many_attempts" }, 429);
      }
      await record(false);
      return await invalid();
    }

    await record(true);
    const s = data.session;
    return json(origin, {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_in: s.expires_in,
      expires_at: s.expires_at,
      token_type: s.token_type,
      login_kind: id.kind,
    });
  } catch (e) {
    console.error("login-with-identifier error", e instanceof Error ? e.name : "unknown");
    await padFailure(startedAt);
    return json(origin, { error: "invalid_credentials", ...(hint ? { hint } : {}) }, 401);
  }
});

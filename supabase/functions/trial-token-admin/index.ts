import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { callerIsPlatformModerator } from "../_shared/platformAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Personal Growth trial: same route as 7-day trial, but `token` forces 60-day personal flow. */
function trialUrl(origin: string, token: string) {
  const path = `/pro-plans/trial?token=${encodeURIComponent(token)}`;
  return origin ? `${origin}${path}` : path;
}

function setupError(e: unknown) {
  const message = (e as Error).message ?? String(e);
  const lower = message.toLowerCase();
  if (
    lower.includes("trial_tokens") ||
    lower.includes("cleanup_trial_tokens") ||
    lower.includes("token_value") ||
    lower.includes("schema cache")
  ) {
    return "Trial database tables are not up to date yet. Run supabase/migrations/20260502120000_growth_trial_system.sql and supabase/migrations/20260502130000_trial_tokens_copyable_no_expiry.sql in Supabase, then redeploy the trial functions.";
  }
  return message;
}

type TokenRow = {
  id: string;
  duration_days: number;
  created_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  token_value: string | null;
};

async function enrichClaimedUsers(
  admin: ReturnType<typeof createClient>,
  rows: TokenRow[],
): Promise<{
  emailByUserId: Map<string, string>;
  numberByUserId: Map<string, string>;
}> {
  const ids = [...new Set(rows.map((r) => r.used_by_user_id).filter((x): x is string => !!x))];
  const emailByUserId = new Map<string, string>();
  const numberByUserId = new Map<string, string>();
  if (ids.length === 0) return { emailByUserId, numberByUserId };

  const { data: profs, error: profErr } = await admin.from("profiles").select("user_id, public_user_number").in("user_id", ids);
  if (profErr) console.warn("trial-token-admin profiles lookup:", profErr.message);
  for (const p of profs ?? []) {
    const uid = (p as { user_id: string }).user_id;
    const num = (p as { public_user_number?: string | null }).public_user_number;
    if (typeof num === "string" && num.trim()) numberByUserId.set(uid, num.trim());
  }

  for (const uid of ids) {
    const { data, error } = await admin.auth.admin.getUserById(uid);
    if (error) {
      console.warn("trial-token-admin getUserById:", uid, error.message);
      continue;
    }
    const em = data.user?.email;
    if (typeof em === "string" && em.trim()) emailByUserId.set(uid, em.trim());
  }

  return { emailByUserId, numberByUserId };
}

function mapRowsToPayload(
  rows: TokenRow[],
  origin: string,
  emailByUserId: Map<string, string>,
  numberByUserId: Map<string, string>,
) {
  return rows.map((row) => {
    const unclaimed = row.used_at == null;
    const token = row.token_value;
    const url = unclaimed && token ? trialUrl(origin, token) : undefined;
    const uid = row.used_by_user_id;
    return {
      id: row.id,
      duration_days: row.duration_days,
      created_at: row.created_at,
      used_at: row.used_at,
      status: unclaimed ? "unclaimed" : "claimed",
      url,
      claimed_by_email: uid ? emailByUserId.get(uid) ?? null : null,
      claimed_by_public_user_number: uid ? numberByUserId.get(uid) ?? null : null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);
  if (!(await callerIsPlatformModerator(admin, user.id, user.email))) return json({ error: "Forbidden" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "list";
    const origin = typeof body.origin === "string" && body.origin.startsWith("http") ? body.origin.replace(/\/+$/, "") : "";

    await admin.rpc("cleanup_trial_tokens");

    if (action === "generate") {
      const token = makeToken();
      const tokenHash = await sha256Hex(token);
      const { data: row, error: insertErr } = await admin
        .from("trial_tokens")
        .insert({
          token_hash: tokenHash,
          token_value: token,
          source: "personal",
          duration_days: 60,
          expires_at: null,
          created_by_user_id: user.id,
        })
        .select("id, created_at")
        .single();
      if (insertErr) throw insertErr;

      const generated = [{
        id: row.id,
        token,
        url: trialUrl(origin, token),
        created_at: row.created_at,
      }];

      const { data: allRows, error: listErr } = await admin
        .from("trial_tokens")
        .select("id, duration_days, created_at, used_at, used_by_user_id, token_value")
        .order("created_at", { ascending: false })
        .limit(300);
      if (listErr) throw listErr;

      const rows = (allRows ?? []) as TokenRow[];
      const { emailByUserId, numberByUserId } = await enrichClaimedUsers(admin, rows);

      return json({
        ok: true,
        generated,
        active: mapRowsToPayload(rows, origin, emailByUserId, numberByUserId),
      });
    }

    const { data: allRows, error: activeErr } = await admin
      .from("trial_tokens")
      .select("id, duration_days, created_at, used_at, used_by_user_id, token_value")
      .order("created_at", { ascending: false })
      .limit(300);
    if (activeErr) throw activeErr;

    const rows = (allRows ?? []) as TokenRow[];
    const { emailByUserId, numberByUserId } = await enrichClaimedUsers(admin, rows);

    return json({
      ok: true,
      active: mapRowsToPayload(rows, origin, emailByUserId, numberByUserId),
      generated: [],
    });
  } catch (e) {
    return json({ error: setupError(e) }, 500);
  }
});

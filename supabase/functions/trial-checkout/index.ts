import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TrialSource = "normal" | "freetrial" | "personal";
type TrialGrant = {
  id: string;
  user_id: string;
  pro_profile_id: string | null;
  plan_id: string;
  source: TrialSource;
  status: "pending_profile" | "active" | "expired" | "cancelled";
  duration_days: number;
  square_customer_id: string;
  square_card_id: string;
  square_card_fingerprint: string | null;
  signup_ip: string | null;
  token_id: string | null;
};

const DURATION_DAYS: Record<TrialSource, number> = {
  normal: 7,
  freetrial: 14,
  personal: 60,
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function squareBaseUrl() {
  return Deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function setupError(e: unknown) {
  const message = (e as Error).message ?? String(e);
  const lower = message.toLowerCase();
  if (
    lower.includes("trial_grants") ||
    lower.includes("trial_attempts") ||
    lower.includes("trial_tokens") ||
    lower.includes("schema cache")
  ) {
    return "Trial database tables are not installed yet. Run supabase/migrations/20260502120000_growth_trial_system.sql in Supabase, then redeploy the trial functions.";
  }
  return message;
}

async function squareRequest(path: string, body: Record<string, unknown>) {
  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  if (!accessToken) throw new Error("Square not configured");

  const res = await fetch(`${squareBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.errors?.[0]?.detail ?? data.errors?.[0]?.code ?? "Square request failed";
    throw new Error(detail);
  }
  return data;
}

async function getOrCreateSquareCustomer(user: { id: string; email?: string | null }) {
  const email = user.email?.trim();
  if (!email) throw new Error("Your account needs an email address.");

  const search = await squareRequest("/v2/customers/search", {
    query: {
      filter: {
        email_address: {
          exact: email,
        },
      },
    },
    limit: 1,
  });

  const existing = Array.isArray(search.customers) ? search.customers[0] : null;
  if (existing?.id) return existing.id as string;

  const created = await squareRequest("/v2/customers", {
    idempotency_key: `trial-customer-${user.id}`,
    email_address: email,
    reference_id: user.id,
  });
  const customerId = created.customer?.id;
  if (!customerId) throw new Error("Could not create Square customer.");
  return customerId as string;
}

async function createSquareCard(user: { id: string; email?: string | null }, sourceId: string, customerId: string) {
  const created = await squareRequest("/v2/cards", {
    idempotency_key: crypto.randomUUID(),
    source_id: sourceId,
    card: {
      customer_id: customerId,
      reference_id: user.id,
    },
  });
  const card = created.card;
  if (!card?.id) throw new Error("Could not store Square payment method.");
  return {
    id: card.id as string,
    fingerprint: typeof card.fingerprint === "string" ? (card.fingerprint as string) : null,
  };
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
  if (!user.email_confirmed_at) return json({ error: "Please verify your email first." }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "start";
    const ipAddress = clientIp(req);

    const { data: profile } = await admin
      .from("pro_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (action === "activate_pending") {
      const { data: pending, error: pendingErr } = await admin
        .from("trial_grants")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending_profile")
        .maybeSingle();
      if (pendingErr) throw pendingErr;
      if (!pending) return json({ error: "No pending trial found." }, 404);
      if (!profile?.id) return json({ ok: true, needs_profile: true, message: "Create your pro profile to activate your trial." });

      const nowIso = new Date().toISOString();
      const trialEndsAt = new Date(Date.now() + Number(pending.duration_days) * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("pro_subscriptions").upsert(
        {
          user_id: user.id,
          plan_id: "growth",
          billing_start: nowIso,
          billing_cycle_days: 30,
          trial_ends_at: trialEndsAt,
          trial_source: pending.source,
          square_customer_id: pending.square_customer_id,
          square_card_id: pending.square_card_id,
          square_card_fingerprint: pending.square_card_fingerprint,
          square_trial_used: true,
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );
      await admin.from("pro_profiles").update({ subscription_tier: "growth", updated_at: nowIso }).eq("id", profile.id);
      await admin
        .from("trial_grants")
        .update({
          pro_profile_id: profile.id,
          status: "active",
          trial_started_at: nowIso,
          trial_ends_at: trialEndsAt,
          updated_at: nowIso,
        })
        .eq("id", pending.id);

      return json({ ok: true, activated: true, trial_ends_at: trialEndsAt, plan_id: "growth" });
    }

    const source = typeof body.source === "string" ? body.source.trim().toLowerCase() : "";
    if (!["normal", "freetrial", "personal"].includes(source)) return json({ error: "Invalid trial source." }, 400);
    const trialSource = source as TrialSource;
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : "";
    if (!sourceId) return json({ error: "Square payment method is required to start a trial." }, 400);

    const { data: existingGrant } = await admin.from("trial_grants").select("status").eq("user_id", user.id).maybeSingle();
    if (existingGrant) return json({ error: "Trial already used for this account." }, 409);

    const { data: existingSub } = await admin
      .from("pro_subscriptions")
      .select("square_trial_used")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingSub?.square_trial_used) return json({ error: "Trial already used for this account." }, 409);

    let tokenRow: { id: string; used_at: string | null } | null = null;
    if (trialSource === "personal") {
      const rawToken = typeof body.token === "string" ? body.token.trim() : "";
      if (!rawToken) return json({ error: "Personal trial token is required." }, 400);
      const tokenHash = await sha256Hex(rawToken);
      const { data: hashedToken, error: tokenErr } = await admin
        .from("trial_tokens")
        .select("id, used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (tokenErr) throw tokenErr;
      let token = hashedToken;
      if (!token) {
        const direct = await admin
          .from("trial_tokens")
          .select("id, used_at")
          .eq("token_value", rawToken)
          .maybeSingle();
        if (direct.error) throw direct.error;
        token = direct.data;
      }
      if (!token || token.used_at) {
        return json({ error: "This personal trial link has already been used or is invalid." }, 400);
      }
      tokenRow = token;
    }

    const customerId = await getOrCreateSquareCustomer(user);
    const { data: usedCustomerGrant } = await admin
      .from("trial_grants")
      .select("id")
      .eq("square_customer_id", customerId)
      .limit(1)
      .maybeSingle();
    const { data: usedCustomerSub } = await admin
      .from("pro_subscriptions")
      .select("user_id")
      .eq("square_customer_id", customerId)
      .eq("square_trial_used", true)
      .limit(1)
      .maybeSingle();
    if (usedCustomerGrant || usedCustomerSub) return json({ error: "Trial already used with this Square account." }, 409);

    const card = await createSquareCard(user, sourceId, customerId);
    if (card.fingerprint) {
      const { data: usedCardGrant } = await admin
        .from("trial_grants")
        .select("id")
        .eq("square_card_fingerprint", card.fingerprint)
        .limit(1)
        .maybeSingle();
      const { data: usedCardSub } = await admin
        .from("pro_subscriptions")
        .select("user_id")
        .eq("square_card_fingerprint", card.fingerprint)
        .eq("square_trial_used", true)
        .limit(1)
        .maybeSingle();
      if (usedCardGrant || usedCardSub) return json({ error: "Trial already used with this payment method." }, 409);
    }

    const durationDays = DURATION_DAYS[trialSource];
    const nowIso = new Date().toISOString();
    const trialEndsAt = profile?.id ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;
    const status = profile?.id ? "active" : "pending_profile";

    const grantPayload = {
      user_id: user.id,
      pro_profile_id: profile?.id ?? null,
      plan_id: "growth",
      source: trialSource,
      status,
      duration_days: durationDays,
      trial_started_at: profile?.id ? nowIso : null,
      trial_ends_at: trialEndsAt,
      square_customer_id: customerId,
      square_card_id: card.id,
      square_card_fingerprint: card.fingerprint,
      signup_ip: ipAddress,
      token_id: tokenRow?.id ?? null,
      updated_at: nowIso,
    };

    const { data: grant, error: grantErr } = await admin.from("trial_grants").insert(grantPayload).select("*").single();
    if (grantErr) throw grantErr;

    if (tokenRow) {
      const { data: claimedToken, error: claimTokenErr } = await admin
        .from("trial_tokens")
        .update({ used_at: nowIso, used_by_user_id: user.id, token_value: null })
        .eq("id", tokenRow.id)
        .is("used_at", null)
        .select("id")
        .maybeSingle();
      if (claimTokenErr) throw claimTokenErr;
      if (!claimedToken) {
        await admin.from("trial_grants").delete().eq("id", grant.id);
        return json({ error: "This personal trial link has already been used or is invalid." }, 400);
      }
    }

    const { error: attemptLogErr } = await admin.from("trial_attempts").insert({
      ip_address: ipAddress,
      user_id: user.id,
      source: trialSource,
    });
    if (attemptLogErr) console.warn("Could not log successful trial attempt:", attemptLogErr.message);

    if (!profile?.id) {
      return json({
        ok: true,
        needs_profile: true,
        status: "pending_profile",
        duration_days: durationDays,
        message: "Create your pro profile to activate your Growth trial.",
      });
    }

    await admin.from("pro_subscriptions").upsert(
      {
        user_id: user.id,
        plan_id: "growth",
        billing_start: nowIso,
        billing_cycle_days: 30,
        trial_ends_at: trialEndsAt,
        trial_source: trialSource,
        square_customer_id: customerId,
        square_card_id: card.id,
        square_card_fingerprint: card.fingerprint,
        square_trial_used: true,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );
    await admin.from("pro_profiles").update({ subscription_tier: "growth", updated_at: nowIso }).eq("id", profile.id);

    return json({
      ok: true,
      activated: true,
      trial_ends_at: trialEndsAt,
      duration_days: durationDays,
      plan_id: (grant as TrialGrant).plan_id ?? "growth",
    });
  } catch (e) {
    return json({ error: setupError(e) }, 500);
  }
});

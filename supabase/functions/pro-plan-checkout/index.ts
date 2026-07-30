import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_IDS = ["starter", "growth", "pro"] as const;
type PlanId = (typeof PLAN_IDS)[number];

/** Fallback when DB catalog is empty or migration not applied (CAD cents). */
const DEFAULT_PLAN_PRICE_CENTS: Record<PlanId, number> = {
  starter: 2000,
  growth: 2700,
  pro: 3200,
};

function isPlanId(s: string): s is PlanId {
  return (PLAN_IDS as readonly string[]).includes(s);
}

/** Merge DB subscription_plans over defaults so upgrades never compute as $0 by accident. */
function buildPriceMap(rows: { id: string; price_cents: number }[] | null): Record<string, number> {
  const map: Record<string, number> = { ...DEFAULT_PLAN_PRICE_CENTS };
  for (const r of rows ?? []) {
    if (!isPlanId(r.id)) continue;
    const cents = typeof r.price_cents === "number" ? r.price_cents : Number(r.price_cents);
    if (Number.isFinite(cents) && cents >= 0) map[r.id] = Math.round(cents);
  }
  return map;
}

/** UTC month start — matches client `inferBillingStartWhenNoSubscriptionRow` when there is no `pro_subscriptions` row. */
function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function inferBillingStartWhenNoSubscriptionRow(profileCreatedAt: string | null | undefined, now = new Date()) {
  const monthStart = startOfUtcMonth(now);
  if (!profileCreatedAt) return monthStart;
  const created = new Date(profileCreatedAt);
  if (Number.isNaN(created.getTime())) return monthStart;
  const createdDayUtc = new Date(Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate(), 0, 0, 0, 0));
  return createdDayUtc > monthStart ? createdDayUtc : monthStart;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const previewOnly = body.preview_only === true;
    const newPlanRaw = typeof body.new_plan_id === "string" ? body.new_plan_id.trim().toLowerCase() : "";
    const proProfileId = typeof body.pro_profile_id === "string" ? body.pro_profile_id.trim() : "";
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : "";

    if (!proProfileId || !isPlanId(newPlanRaw)) {
      return new Response(JSON.stringify({ error: "Invalid request", details: "new_plan_id and pro_profile_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profErr } = await admin
      .from("pro_profiles")
      .select("id, user_id, subscription_tier, created_at, cancel_return_discount_pending, cancel_return_discount_consumed_at")
      .eq("id", proProfileId)
      .maybeSingle();

    if (profErr || !profile || profile.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden", details: "Not your pro profile" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await admin.from("pro_subscriptions").select("*").eq("user_id", user.id).maybeSingle();

    const subPlanRaw = typeof sub?.plan_id === "string" ? sub.plan_id.toLowerCase() : "";
    const hasPaidPlanRow =
      !!(sub && (subPlanRaw === "starter" || subPlanRaw === "growth" || subPlanRaw === "pro"));
    const billingPlanId: PlanId | null = hasPaidPlanRow ? (subPlanRaw as PlanId) : null;

    if (hasPaidPlanRow && billingPlanId === newPlanRaw) {
      return new Response(JSON.stringify({ error: "Already on this plan", current_plan_id: billingPlanId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: planRows } = await admin.from("subscription_plans").select("id, price_cents").in("id", [...PLAN_IDS]);
    const priceById = buildPriceMap(planRows ?? []);
    const newPrice = priceById[newPlanRaw];

    const billingAnchorIso = sub
      ? sub.billing_start
      : inferBillingStartWhenNoSubscriptionRow(
          typeof profile.created_at === "string" ? profile.created_at : null,
        ).toISOString();

    let chargeCents = 0;
    let mode: "first_month" | "upgrade_prorate" | "downgrade" = "downgrade";
    let oldPrice = 0;

    const returnDiscountEligible =
      profile.cancel_return_discount_pending === true && profile.cancel_return_discount_consumed_at == null;

    let cancelReturnDiscountApplied = false;

    if (!hasPaidPlanRow) {
      // Hold or missing row: first purchase of starter/growth/pro charges full catalog month.
      chargeCents = newPrice;
      mode = "first_month";
      oldPrice = 0;
      if (returnDiscountEligible && newPrice > 0) {
        chargeCents = Math.round(chargeCents * 0.8);
        cancelReturnDiscountApplied = true;
      }
    } else {
      const currentTier = billingPlanId!;
      oldPrice = currentTier === "starter" ? DEFAULT_PLAN_PRICE_CENTS.starter : priceById[currentTier];

      if (newPrice <= oldPrice) {
        chargeCents = 0;
        mode = "downgrade";
      } else {
        const cycleDays = sub?.billing_cycle_days ?? 30;
        const { data: prAmount, error: rpcErr } = await admin.rpc("calculate_proration", {
          old_price_cents: oldPrice,
          new_price_cents: newPrice,
          billing_start: billingAnchorIso,
          cycle_days: cycleDays,
        });
        if (rpcErr) throw rpcErr;
        const dollars = typeof prAmount === "number" ? prAmount : Number(prAmount);
        chargeCents = Math.round(dollars * 100);
        mode = "upgrade_prorate";
      }
    }

    if (chargeCents > 0 && chargeCents < 50) chargeCents = 50;

    if (previewOnly) {
      return new Response(
        JSON.stringify({
          ok: true,
          preview: true,
          charge_cents: chargeCents,
          monthly_old_cents: oldPrice,
          monthly_new_cents: newPrice,
          current_plan_id: hasPaidPlanRow ? billingPlanId : null,
          new_plan_id: newPlanRaw,
          mode,
          billing_period_start: billingAnchorIso,
          billing_cycle_days: sub?.billing_cycle_days ?? 30,
          has_subscription_row: !!sub,
          cancel_return_discount_applied: cancelReturnDiscountApplied,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (chargeCents > 0 && !sourceId) {
      return new Response(JSON.stringify({ error: "source_id required for this charge amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");
    if (chargeCents > 0 && !accessToken) {
      return new Response(JSON.stringify({ error: "Square not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let paymentId: string | null = null;
    if (chargeCents > 0 && accessToken) {
      const idempotencyKey = crypto.randomUUID();
      const useSandbox = Deno.env.get("SQUARE_ENVIRONMENT") !== "production";
      const squareBase = useSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
      const squareBody: Record<string, unknown> = {
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: chargeCents,
          currency: "CAD",
        },
        autocomplete: true,
        reference_id: `pro-plan-${newPlanRaw}`.slice(0, 40),
      };
      if (locationId) squareBody.location_id = locationId;

      const squareRes = await fetch(`${squareBase}/v2/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2024-01-18",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(squareBody),
      });
      const sqData = await squareRes.json().catch(() => ({}));
      paymentId = sqData.payment?.id ?? null;
      if (!squareRes.ok) {
        const errMsg = sqData.errors?.[0]?.detail ?? sqData.errors?.[0]?.code ?? "Square error";
        return new Response(JSON.stringify({ error: "Payment failed", details: errMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("payments").upsert(
        {
          booking_id: null,
          pro_profile_id: proProfileId,
          client_id: user.id,
          amount_cents: chargeCents,
          currency: "CAD",
          square_payment_id: paymentId,
          status: (sqData.payment?.status ?? "completed").toLowerCase(),
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key" }
      );
    }

    const nowIso = new Date().toISOString();
    const billingStartForRow = sub?.billing_start ?? billingAnchorIso;

    await admin.from("pro_subscriptions").upsert(
      {
        user_id: user.id,
        plan_id: newPlanRaw,
        billing_start: billingStartForRow,
        billing_cycle_days: sub?.billing_cycle_days ?? 30,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );

    await admin
      .from("pro_profiles")
      .update({ subscription_tier: newPlanRaw, updated_at: nowIso })
      .eq("id", proProfileId);

    if (returnDiscountEligible && !hasPaidPlanRow) {
      await admin
        .from("pro_profiles")
        .update({
          cancel_return_discount_pending: false,
          cancel_return_discount_consumed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", proProfileId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        charged_cents: chargeCents,
        monthly_old_cents: oldPrice,
        monthly_new_cents: newPrice,
        payment_id: paymentId,
        new_plan_id: newPlanRaw,
        mode,
        cancel_return_discount_applied: cancelReturnDiscountApplied,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

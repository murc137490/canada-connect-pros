import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CANCEL_REASONS = new Set(["unsatisfactory", "dont_use", "complicated", "expensive", "dislike"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  try {
    const body = await req.json().catch(() => ({}));
    const confirm = body.confirm === true;
    const reason = typeof body.reason === "string" ? body.reason.trim().toLowerCase() : "";

    if (!confirm) return json({ error: "Confirmation required." }, 400);
    if (!CANCEL_REASONS.has(reason)) return json({ error: "Invalid cancellation reason." }, 400);

    const { data: profile, error: pErr } = await admin
      .from("pro_profiles")
      .select("id, user_id, cancel_return_discount_pending, cancel_return_discount_consumed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile?.id) return json({ error: "No pro profile found." }, 404);

    const { data: sub, error: sErr } = await admin.from("pro_subscriptions").select("plan_id").eq("user_id", user.id).maybeSingle();
    if (sErr) throw sErr;
    const plan = (sub?.plan_id as string | undefined)?.toLowerCase().trim() ?? "";
    if (plan === "hold" || !(plan === "starter" || plan === "growth" || plan === "pro")) {
      return json({ error: "No active paid plan to cancel." }, 400);
    }

    const nowIso = new Date().toISOString();

    await admin
      .from("pro_subscriptions")
      .update({
        plan_id: "hold",
        trial_ends_at: null,
        trial_source: null,
        square_trial_used: false,
        updated_at: nowIso,
      })
      .eq("user_id", user.id);

    await admin.from("pro_profiles").update({ subscription_tier: "hold", updated_at: nowIso }).eq("id", profile.id);

    const { error: logErr } = await admin.from("pro_plan_cancellations").insert({
      user_id: user.id,
      pro_profile_id: profile.id,
      previous_plan_id: plan,
      reason_key: reason,
    });
    if (logErr) console.warn("pro_plan_cancellations insert:", logErr.message);

    let cancelReturnDiscountGranted = false;
    const consumed = profile.cancel_return_discount_consumed_at != null;
    const alreadyPending = profile.cancel_return_discount_pending === true;
    if (!consumed && !alreadyPending) {
      const { error: discErr } = await admin
        .from("pro_profiles")
        .update({ cancel_return_discount_pending: true, updated_at: nowIso })
        .eq("id", profile.id);
      if (discErr) console.warn("cancel_return_discount_pending:", discErr.message);
      else cancelReturnDiscountGranted = true;
    }

    return json({ ok: true, cancel_return_discount_granted: cancelReturnDiscountGranted });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});

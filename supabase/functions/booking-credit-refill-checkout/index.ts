import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
function squareBase() {
  const app = (Deno.env.get("SQUARE_APPLICATION_ID") ?? Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ?? "").trim();
  return app.startsWith("sq0idp-") || Deno.env.get("SQUARE_ENVIRONMENT") === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = req.headers.get("Authorization");
  if (!url || !anon || !service || !bearer) return json({ error: "Unauthorized" }, 401);
  const authDb = createClient(url, anon, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authDb.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const proId = typeof body.pro_profile_id === "string" ? body.pro_profile_id : "";
    const amount = Number(body.credit_amount);
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : "";
    const idempotencyKey = typeof body.idempotency_key === "string" && /^[0-9a-f-]{36}$/i.test(body.idempotency_key) ? body.idempotency_key : crypto.randomUUID();
    if (!proId || !Number.isInteger(amount) || !sourceId) return json({ error: "Invalid refill request" }, 400);
    const [{ data: profile }, { data: sub }] = await Promise.all([
      db.from("pro_profiles").select("id,user_id").eq("id", proId).maybeSingle(),
      db.from("pro_subscriptions").select("plan_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!profile || profile.user_id !== user.id) return json({ error: "Not your professional account" }, 403);
    const planId = String(sub?.plan_id ?? "").toLowerCase();
    if (!["starter", "growth", "pro"].includes(planId)) return json({ error: "Choose an active Starter, Growth, or Pro plan before buying refills" }, 409);
    const { data: catalog } = await db.from("booking_credit_refill_prices").select("price_cents").eq("plan_id", planId).eq("credit_amount", amount).maybeSingle();
    if (!catalog) return json({ error: "That refill is not available for your plan" }, 400);
    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN"), locationId = Deno.env.get("SQUARE_LOCATION_ID");
    if (!accessToken) return json({ error: "Square is not configured" }, 503);
    const sq = await fetch(`${squareBase()}/v2/payments`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "Square-Version": "2024-01-18" }, body: JSON.stringify({ source_id: sourceId, idempotency_key: idempotencyKey, amount_money: { amount: Number(catalog.price_cents), currency: "CAD" }, autocomplete: true, ...(locationId ? { location_id: locationId } : {}), reference_id: `credit-refill-${amount}-${planId}` }) });
    const paymentData = await sq.json().catch(() => ({}));
    if (!sq.ok || !paymentData.payment?.id) return json({ error: paymentData.errors?.[0]?.detail ?? "Square payment failed" }, 402);
    const paymentId = String(paymentData.payment.id);
    const { error: paymentError } = await db.from("payments").upsert({ booking_id: null, pro_profile_id: proId, client_id: user.id, amount_cents: Number(catalog.price_cents), currency: "CAD", square_payment_id: paymentId, status: String(paymentData.payment.status ?? "completed").toLowerCase(), idempotency_key: idempotencyKey }, { onConflict: "idempotency_key" });
    if (paymentError) throw paymentError;
    const { error: grantError } = await db.rpc("grant_booking_credits", { p_pro_profile_id: proId, p_grant_type: "purchased", p_amount: amount, p_source_reference: `square:${paymentId}:refill:${amount}`, p_expires_at: null, p_reason: `${amount} Booking Credit refill (${planId})`, p_metadata: { plan_id: planId, price_cents: Number(catalog.price_cents), square_payment_id: paymentId } });
    if (grantError) throw grantError;
    return json({ ok: true, payment_id: paymentId, credit_amount: amount, charged_cents: Number(catalog.price_cents) });
  } catch (error) {
    console.error("Booking credit refill failed", error);
    return json({ error: "Booking Credit refill could not be completed" }, 500);
  }
});

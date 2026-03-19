// Square Create Payment: Web Payments SDK token → Square charge.
// With Supabase "Verify JWT" ON: only requests with valid Authorization reach this code.
// We also ensure the logged-in user matches body.client_id so users cannot charge on behalf of others.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    return new Response(
      JSON.stringify({ error: "Unauthorized", details: "Missing or invalid Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured", details: "SUPABASE_URL or SUPABASE_ANON_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", details: "Invalid or expired session" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID");
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Square not configured", details: "SQUARE_ACCESS_TOKEN missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : null;
    const amountCents = Math.round(Number(body.amount_cents) || 0);
    const currency = (body.currency ?? "cad").toString().toUpperCase().slice(0, 3);
    const proProfileId = body.pro_profile_id ?? null;
    const bookingId = body.booking_id ?? null;
    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : null;

    if (!clientId || clientId !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden", details: "client_id must match the signed-in user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: "source_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Invalid amount", details: "Minimum 50 cents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!proProfileId) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: "pro_profile_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idempotencyKey = crypto.randomUUID();

    const squareBody: Record<string, unknown> = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: amountCents,
        currency,
      },
      autocomplete: true,
      reference_id: (bookingId ?? proProfileId).toString().slice(0, 40),
    };
    if (locationId) squareBody.location_id = locationId;

    const useSandbox = Deno.env.get("SQUARE_ENVIRONMENT") !== "production";
    const squareBase = useSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const squareRes = await fetch(`${squareBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(squareBody),
    });

    const data = await squareRes.json().catch(() => ({}));
    const paymentId = data.payment?.id ?? null;
    const paymentStatus = data.payment?.status ?? "UNKNOWN";

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRoleKey && supabaseUrl) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("payments").upsert(
        {
          booking_id: bookingId || null,
          pro_profile_id: proProfileId,
          amount_cents: amountCents,
          currency,
          square_payment_id: paymentId,
          status: paymentStatus.toLowerCase(),
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key" }
      );
    }

    if (!squareRes.ok) {
      const errMsg = data.errors?.[0]?.detail ?? data.errors?.[0]?.code ?? data.message ?? "Square error";
      return new Response(
        JSON.stringify({ error: "Payment failed", details: errMsg }),
        { status: squareRes.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ payment_id: paymentId, status: paymentStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

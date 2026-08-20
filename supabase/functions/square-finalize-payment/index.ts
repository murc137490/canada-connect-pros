import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Complete (capture) or cancel (void) a previously authorized Square payment.
 * Used when a pro accepts or declines a booking that was card-held at request time.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function squareApiBase(): string {
  return Deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

type TokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  merchant_id: string;
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

  const body = await req.json().catch(() => ({}));
  const action = body.action === "cancel" ? "cancel" : body.action === "complete" ? "complete" : null;
  const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
  if (!action || !bookingId) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: "action (complete|cancel) and booking_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, pro_profile_id, client_id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr || !booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: pro } = await admin
    .from("pro_profiles")
    .select("id, user_id")
    .eq("id", booking.pro_profile_id)
    .maybeSingle();
  const isProOwner = pro?.user_id === user.id;
  const isClient = booking.client_id === user.id;
  if (!isProOwner && !(action === "cancel" && isClient)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, square_payment_id, status, pro_profile_id")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const squarePaymentId =
    typeof payment?.square_payment_id === "string" ? payment.square_payment_id.trim() : "";
  if (!squarePaymentId) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, details: "No Square payment to finalize" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const status = String(payment?.status ?? "").toLowerCase();
  if (status === "completed" || status === "captured") {
    return new Response(JSON.stringify({ ok: true, skipped: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((status === "canceled" || status === "cancelled" || status === "voided") && action === "cancel") {
    return new Response(JSON.stringify({ ok: true, skipped: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let bearerToken = Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "";
  const { data: tok } = await admin
    .from("pro_square_tokens")
    .select("access_token, refresh_token, expires_at, merchant_id")
    .eq("pro_profile_id", booking.pro_profile_id)
    .maybeSingle();
  const row = tok as TokenRow | null;
  if (row?.access_token) bearerToken = row.access_token;
  if (!bearerToken) {
    return new Response(JSON.stringify({ error: "Square not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const path = action === "complete" ? "complete" : "cancel";
  const squareRes = await fetch(`${squareApiBase()}/v2/payments/${encodeURIComponent(squarePaymentId)}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({}),
  });
  const data = await squareRes.json().catch(() => ({}));
  if (!squareRes.ok) {
    const errMsg = data.errors?.[0]?.detail ?? data.errors?.[0]?.code ?? data.message ?? "Square error";
    return new Response(JSON.stringify({ error: "Finalize failed", details: errMsg }), {
      status: squareRes.status >= 500 ? 502 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paymentObj = (data.payment ?? null) as Record<string, unknown> | null;
  const newStatus = String(paymentObj?.status ?? (action === "complete" ? "COMPLETED" : "CANCELED")).toLowerCase();
  await admin
    .from("payments")
    .update({ status: newStatus })
    .eq("id", payment!.id);

  return new Response(JSON.stringify({ ok: true, status: newStatus, payment_id: squarePaymentId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

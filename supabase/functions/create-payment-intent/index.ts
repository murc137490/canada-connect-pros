// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured", details: "STRIPE_SECRET_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const amountCents = Math.round(Number(body.amount_cents) || 0);
    const currency = (body.currency ?? "cad").toString().toLowerCase().slice(0, 3);
    const proProfileId = body.pro_profile_id ?? null;
    const clientId = body.client_id ?? null;

    if (amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Invalid amount", details: "Minimum 50 cents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams();
    params.set("amount", String(amountCents));
    params.set("currency", currency);
    params.set("automatic_payment_methods[enabled]", "true");
    if (proProfileId) params.set("metadata[pro_profile_id]", String(proProfileId));
    if (clientId) params.set("metadata[client_id]", String(clientId));

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await stripeRes.json();
    if (data.error) {
      return new Response(
        JSON.stringify({ error: "Stripe error", details: data.error?.message ?? data.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ client_secret: data.client_secret, payment_intent_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

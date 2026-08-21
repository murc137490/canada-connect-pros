// Square Create Payment: Web Payments SDK token → Square charge.
// If the pro has OAuth tokens (pro_square_tokens), charges run on the seller account with app_fee_money =
// 2.1% of service subtotal (platform share). Checkout still shows one ~5% “card & platform” line on the service
// amount (~2.9% processing + 2.1% platform — not 2.9% + an extra 5% app fee).
// Otherwise falls back to platform SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID (legacy).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function squareApiBase(): string {
  const env = (Deno.env.get("SQUARE_ENVIRONMENT") ?? "").trim().toLowerCase();
  const appId = (
    Deno.env.get("SQUARE_APPLICATION_ID") ??
    Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ??
    ""
  ).trim();
  const production = env === "production" || (!env && appId.startsWith("sq0idp-"));
  return production ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

type TokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  merchant_id: string;
};

async function refreshSquareAccess(args: {
  refresh_token: string;
  client_id: string;
  client_secret: string;
}): Promise<{ access_token: string; refresh_token: string | null; expires_at: string | null } | null> {
  const base = squareApiBase();
  const res = await fetch(`${base}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      client_id: args.client_id,
      client_secret: args.client_secret,
      grant_type: "refresh_token",
      refresh_token: args.refresh_token,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return null;
  const access_token = typeof data.access_token === "string" ? data.access_token : "";
  const refresh_token = typeof data.refresh_token === "string" ? data.refresh_token : args.refresh_token;
  let expires_at: string | null = null;
  if (typeof data.expires_at === "string") expires_at = data.expires_at;
  else if (typeof data.expires_at === "number" && Number.isFinite(data.expires_at)) {
    expires_at = new Date(data.expires_at).toISOString();
  }
  if (!access_token) return null;
  return { access_token, refresh_token, expires_at };
}

function tokenNeedsRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now() + 5 * 60 * 1000;
}

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

  const platformAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const platformLocationId = Deno.env.get("SQUARE_LOCATION_ID");

  try {
    const body = await req.json().catch(() => ({}));
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : null;
    const amountCents = Math.round(Number(body.amount_cents) || 0);
    const baseAmountCents = Math.round(Number(body.base_amount_cents) || 0);
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

    const clientIdempotency =
      typeof body.idempotency_key === "string" ? body.idempotency_key.trim().slice(0, 128) : "";
    const idempotencyKey =
      clientIdempotency.length >= 8 ? clientIdempotency : crypto.randomUUID();

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin =
      serviceRoleKey && supabaseUrl ? createClient(supabaseUrl, serviceRoleKey) : null;

    let bearerToken = platformAccessToken ?? "";
    let locationId: string | null = typeof platformLocationId === "string" && platformLocationId.trim()
      ? platformLocationId.trim()
      : null;
    let useSellerAccount = false;
    let appFeeCents = 0;

    if (admin) {
      const [{ data: tok }, { data: proLoc }] = await Promise.all([
        admin
          .from("pro_square_tokens")
          .select("access_token, refresh_token, expires_at, merchant_id")
          .eq("pro_profile_id", proProfileId)
          .maybeSingle(),
        admin.from("pro_profiles").select("square_location_id").eq("id", proProfileId).maybeSingle(),
      ]);

      const row = tok as TokenRow | null;
      const sellerLocation =
        typeof (proLoc as { square_location_id?: string } | null)?.square_location_id === "string"
          ? String((proLoc as { square_location_id: string }).square_location_id).trim()
          : "";

      if (row?.access_token && sellerLocation) {
        useSellerAccount = true;
        bearerToken = row.access_token;
        locationId = sellerLocation;

        const oauthClientId = (Deno.env.get("SQUARE_OAUTH_APPLICATION_ID") ?? Deno.env.get("SQUARE_APPLICATION_ID") ?? "").trim();
        const oauthSecret = (Deno.env.get("SQUARE_OAUTH_APPLICATION_SECRET") ?? "").trim();

        if (tokenNeedsRefresh(row.expires_at) && row.refresh_token && oauthClientId && oauthSecret) {
          const refreshed = await refreshSquareAccess({
            refresh_token: row.refresh_token,
            client_id: oauthClientId,
            client_secret: oauthSecret,
          });
          if (refreshed) {
            bearerToken = refreshed.access_token;
            await admin.from("pro_square_tokens").upsert(
              {
                pro_profile_id: proProfileId as string,
                merchant_id: row.merchant_id,
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token ?? row.refresh_token,
                expires_at: refreshed.expires_at,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "pro_profile_id" }
            );
          }
        }

        const baseForFee = baseAmountCents > 0 ? baseAmountCents : 0;
        const platformFeeRate = Number(Deno.env.get("PLATFORM_APP_FEE_RATE") ?? "0.021");
        const rate =
          Number.isFinite(platformFeeRate) && platformFeeRate > 0 && platformFeeRate < 1 ? platformFeeRate : 0.021;
        appFeeCents = Math.max(0, Math.round(baseForFee * rate));
        if (appFeeCents >= amountCents) {
          appFeeCents = Math.max(0, Math.min(appFeeCents, amountCents - 1));
        }
      }
    }

    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: "Square not configured", details: "SQUARE_ACCESS_TOKEN missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (useSellerAccount && !locationId) {
      return new Response(
        JSON.stringify({
          error: "Square not ready",
          details: "This professional must reconnect Square (missing location).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const squareBody: Record<string, unknown> = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: amountCents,
        currency,
      },
      autocomplete: body.authorize_only === true || body.autocomplete === false ? false : true,
      reference_id: (bookingId ?? proProfileId).toString().slice(0, 40),
    };
    if (locationId) squareBody.location_id = locationId;

    if (useSellerAccount && appFeeCents > 0) {
      squareBody.app_fee_money = {
        amount: appFeeCents,
        currency,
      };
    }

    const squareBase = squareApiBase();
    const squareRes = await fetch(`${squareBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(squareBody),
    });

    const data = await squareRes.json().catch(() => ({}));
    const payment = (data.payment ?? null) as Record<string, unknown> | null;
    const paymentId = (payment?.id as string | undefined) ?? null;
    const paymentStatus = (payment?.status as string | undefined) ?? "UNKNOWN";

    const cardDetails = payment?.card_details as { card?: { card_brand?: string; last_4?: string } } | undefined;
    const card = cardDetails?.card;
    let paymentMethodLabel = "Carte / Card";
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    if (card?.card_brand && card?.last_4) {
      cardBrand = String(card.card_brand);
      cardLast4 = String(card.last_4);
      paymentMethodLabel = `${cardBrand.replace(/_/g, " ")} ***${cardLast4}`;
    } else if (payment?.source_type && String(payment.source_type).toUpperCase() !== "CARD") {
      paymentMethodLabel = "Portefeuille numérique / Digital wallet";
    }

    if (admin) {
      await admin.from("payments").upsert(
        {
          booking_id: bookingId || null,
          pro_profile_id: proProfileId,
          client_id: clientId,
          amount_cents: amountCents,
          currency,
          square_payment_id: paymentId,
          status: String(paymentStatus).toLowerCase(),
          idempotency_key: idempotencyKey,
          card_brand: cardBrand,
          card_last_4: cardLast4,
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
      JSON.stringify({
        payment_id: paymentId,
        status: paymentStatus,
        payment_method_label: paymentMethodLabel,
        card_brand: cardBrand,
        card_last_4: cardLast4,
        square_connect: useSellerAccount,
        app_fee_cents: useSellerAccount ? appFeeCents : 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

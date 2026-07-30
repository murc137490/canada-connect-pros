/**
 * Sends SMS for Pro-tier pros when enabled (Twilio Messages API).
 * Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM (E.164, e.g. +15551234567)
 *
 * POST JSON:
 * - { "booking_id": "<uuid>", "event": "confirmation" } — caller must be the booking's client (Bearer session).
 * - { "booking_id": "<uuid>", "event": "reminder" } — requires header `x-booking-reminder-secret` matching BOOKING_REMINDER_SECRET (cron / automation).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function basicAuth(accountSid: string, authToken: string): string {
  return btoa(`${accountSid}:${authToken}`);
}

/** Twilio expects E.164; profiles often store local 10-digit numbers. */
function toE164NorthAmerica(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && digits.length >= 11) return `+${digits}`;
  return null;
}

type EventType = "confirmation" | "reminder";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
  const event = (body.event === "reminder" ? "reminder" : "confirmation") as EventType;

  if (!bookingId) {
    return new Response(JSON.stringify({ error: "Missing booking_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNum = Deno.env.get("TWILIO_SMS_FROM");
  if (!accountSid || !authToken || !fromNum) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "twilio_not_configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let userId: string | null = null;
  if (event === "confirmation") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = user.id;
  } else {
    const secret = req.headers.get("x-booking-reminder-secret");
    const expected = Deno.env.get("BOOKING_REMINDER_SECRET");
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select("id, client_id, pro_profile_id, status, preferred_date, preferred_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (event === "confirmation" && booking.client_id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: proRow } = await admin
    .from("pro_profiles")
    .select("business_name, subscription_tier")
    .eq("id", booking.pro_profile_id)
    .maybeSingle();

  const tier = ((proRow?.subscription_tier ?? "starter") as string).toLowerCase();
  if (tier !== "pro") {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "not_pro_tier" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("phone, full_name")
    .eq("user_id", booking.client_id)
    .maybeSingle();

  const rawPhone = typeof profile?.phone === "string" ? profile.phone.trim() : "";
  const to = toE164NorthAmerica(rawPhone);
  if (!to) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_client_phone" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const biz = proRow?.business_name ?? "your professional";
  const datePart = booking.preferred_date ? String(booking.preferred_date) : "";
  const timePart = booking.preferred_time ? String(booking.preferred_time).slice(0, 5) : "";

  const bodyText =
    event === "reminder"
      ? `Reminder: appointment with ${biz}${datePart ? ` on ${datePart}` : ""}${timePart ? ` at ${timePart}` : ""}. Reply STOP to opt out.`
      : `Booking confirmed with ${biz}${datePart ? ` on ${datePart}` : ""}${timePart ? ` at ${timePart}` : ""}. Premiere Services.`;

  const auth = basicAuth(accountSid, authToken);
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", fromNum);
  form.set("Body", bodyText);

  const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const twData = await twRes.json().catch(() => ({}));
  if (!twRes.ok) {
    console.error("Twilio SMS error", twRes.status, twData);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (twData as { message?: string }).message ?? "twilio_error",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true, sid: (twData as { sid?: string }).sid }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

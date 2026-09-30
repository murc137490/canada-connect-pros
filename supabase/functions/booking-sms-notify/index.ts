/**
 * Sends SMS for bookings (confirmation + reminder).
 * Prefers Telnyx when configured; falls back to Twilio.
 *
 * Recipients (when phone on file):
 * - Client
 * - Pro (profiles.phone via pro user_id, else pro_profiles.phone)
 *
 * Gate: Pro subscription_tier must be "pro".
 *
 * POST JSON:
 * - { "booking_id": "<uuid>", "event": "confirmation" } — Bearer = booking client
 * - { "booking_id": "<uuid>", "event": "reminder" } — header x-booking-reminder-secret
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toE164NorthAmerica } from "../_shared/phoneE164.ts";
import { sendTelnyxSms, telnyxSmsConfigured } from "../_shared/telnyxSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function basicAuth(accountSid: string, authToken: string): string {
  return btoa(`${accountSid}:${authToken}`);
}

function twilioSmsConfigured(): boolean {
  return !!(
    Deno.env.get("TWILIO_ACCOUNT_SID")?.trim() &&
    Deno.env.get("TWILIO_AUTH_TOKEN")?.trim() &&
    Deno.env.get("TWILIO_SMS_FROM")?.trim()
  );
}

async function sendTwilioSms(
  to: string,
  text: string,
): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromNum = Deno.env.get("TWILIO_SMS_FROM")!;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", fromNum);
  form.set("Body", text);
  const twRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(accountSid, authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  const twData = await twRes.json().catch(() => ({}));
  if (!twRes.ok) {
    return { ok: false, error: (twData as { message?: string }).message ?? "twilio_error" };
  }
  return { ok: true, sid: (twData as { sid?: string }).sid ?? "" };
}

type EventType = "confirmation" | "reminder";

type BookingRow = {
  id: string;
  client_id: string;
  pro_profile_id: string;
  status: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  sms_reminder_sent_at?: string | null;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const useTelnyx = telnyxSmsConfigured();
  const useTwilio = twilioSmsConfigured();
  if (!useTelnyx && !useTwilio) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "sms_provider_not_configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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

  let booking: BookingRow | null = null;
  {
    const withCol = await admin
      .from("bookings")
      .select("id, client_id, pro_profile_id, status, preferred_date, preferred_time, sms_reminder_sent_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (!withCol.error && withCol.data) {
      booking = withCol.data as BookingRow;
    } else {
      const fb = await admin
        .from("bookings")
        .select("id, client_id, pro_profile_id, status, preferred_date, preferred_time")
        .eq("id", bookingId)
        .maybeSingle();
      if (fb.error || !fb.data) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      booking = { ...(fb.data as BookingRow), sms_reminder_sent_at: null };
    }
  }

  if (event === "confirmation" && booking.client_id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: proRow } = await admin
    .from("pro_profiles")
    .select("business_name, subscription_tier, user_id, phone")
    .eq("id", booking.pro_profile_id)
    .maybeSingle();

  const tier = ((proRow?.subscription_tier ?? "starter") as string).toLowerCase();
  if (tier !== "pro") {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "not_pro_tier" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("phone, full_name")
    .eq("user_id", booking.client_id)
    .maybeSingle();

  let proPhoneRaw = typeof proRow?.phone === "string" ? proRow.phone.trim() : "";
  if (!proPhoneRaw && proRow?.user_id) {
    const { data: proUserProfile } = await admin
      .from("profiles")
      .select("phone")
      .eq("user_id", proRow.user_id)
      .maybeSingle();
    proPhoneRaw = typeof proUserProfile?.phone === "string" ? proUserProfile.phone.trim() : "";
  }

  const clientTo = toE164NorthAmerica(
    typeof clientProfile?.phone === "string" ? clientProfile.phone.trim() : "",
  );
  const proTo = toE164NorthAmerica(proPhoneRaw);

  if (!clientTo && !proTo) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_phones" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const biz = proRow?.business_name ?? "your professional";
  const clientName = (clientProfile?.full_name as string | undefined)?.trim() || "your client";
  const datePart = booking.preferred_date ? String(booking.preferred_date) : "";
  const timePart = booking.preferred_time ? String(booking.preferred_time).slice(0, 5) : "";
  const when = `${datePart ? ` on ${datePart}` : ""}${timePart ? ` at ${timePart}` : ""}`;

  const clientText =
    event === "reminder"
      ? `Reminder: appointment with ${biz}${when}. AltShift. Reply STOP to opt out.`
      : `Booking confirmed with ${biz}${when}. AltShift.`;
  const proText =
    event === "reminder"
      ? `Reminder: job with ${clientName}${when}. AltShift. Reply STOP to opt out.`
      : `New booking with ${clientName}${when}. AltShift.`;

  type SendResult = {
    role: "client" | "pro";
    to: string;
    ok: boolean;
    id?: string;
    error?: string;
    provider: string;
  };
  const results: SendResult[] = [];

  async function sendOne(role: "client" | "pro", to: string, text: string) {
    if (useTelnyx) {
      const result = await sendTelnyxSms({ to, text });
      results.push({
        role,
        to,
        ok: result.ok,
        id: result.ok ? result.id : undefined,
        error: result.ok ? undefined : result.error,
        provider: "telnyx",
      });
      return;
    }
    const result = await sendTwilioSms(to, text);
    results.push({
      role,
      to,
      ok: result.ok,
      id: result.ok ? result.sid : undefined,
      error: result.ok ? undefined : result.error,
      provider: "twilio",
    });
  }

  if (clientTo) await sendOne("client", clientTo, clientText);
  if (proTo && proTo !== clientTo) await sendOne("pro", proTo, proText);

  const anyOk = results.some((r) => r.ok);
  const anyFail = results.some((r) => !r.ok);

  if (event === "reminder" && anyOk) {
    await admin.from("bookings").update({ sms_reminder_sent_at: new Date().toISOString() }).eq("id", bookingId);
  }

  return new Response(
    JSON.stringify({ ok: anyOk && !anyFail ? true : anyOk, partial: anyOk && anyFail, results }),
    { status: anyOk ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

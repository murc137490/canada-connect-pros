/**
 * Hourly cron: find bookings ~24h away and send reminder SMS to client + pro.
 *
 * Auth: header x-booking-reminder-secret === BOOKING_REMINDER_SECRET
 * (same secret used by booking-sms-notify reminder mode)
 *
 * Schedule in Dashboard → Edge Functions → booking-sms-reminders → Schedules
 * Recommended: every hour (0 * * * *)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = req.headers.get("x-booking-reminder-secret");
  const expected = Deno.env.get("BOOKING_REMINDER_SECRET");
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Window: appointments starting between 23h and 25h from now (America/Toronto-ish via UTC window).
  const now = Date.now();
  const startMs = now + 23 * 60 * 60 * 1000;
  const endMs = now + 25 * 60 * 60 * 1000;
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const startDay = startDate.toISOString().slice(0, 10);
  const endDay = endDate.toISOString().slice(0, 10);

  let query = admin
    .from("bookings")
    .select("id, preferred_date, preferred_time, status, sms_reminder_sent_at, pro_profile_id")
    .in("status", ["pending", "accepted", "confirmed"])
    .not("preferred_date", "is", null)
    .gte("preferred_date", startDay)
    .lte("preferred_date", endDay)
    .is("sms_reminder_sent_at", null)
    .limit(100);

  let { data: rows, error } = await query;
  if (error && `${error.message || ""}`.includes("sms_reminder_sent_at")) {
    const fb = await admin
      .from("bookings")
      .select("id, preferred_date, preferred_time, status, pro_profile_id")
      .in("status", ["pending", "accepted", "confirmed"])
      .not("preferred_date", "is", null)
      .gte("preferred_date", startDay)
      .lte("preferred_date", endDay)
      .limit(100);
    rows = (fb.data || []).map((r) => ({ ...r, sms_reminder_sent_at: null }));
    error = fb.error;
  }

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = (rows || []).filter((b) => {
    if (!b.preferred_date) return false;
    const time = b.preferred_time ? String(b.preferred_time).slice(0, 8) : "09:00:00";
    const iso = `${b.preferred_date}T${time.length === 5 ? `${time}:00` : time}`;
    // Interpret as America/Toronto roughly via fixed -04/-05 is hard; treat as local UTC wall for schedule storage.
    const appt = Date.parse(iso + "Z");
    if (Number.isNaN(appt)) return false;
    return appt >= startMs && appt <= endMs;
  });

  // Only Pro-tier pros
  const proIds = [...new Set(candidates.map((c) => c.pro_profile_id).filter(Boolean))];
  const { data: pros } = await admin
    .from("pro_profiles")
    .select("id, subscription_tier")
    .in("id", proIds.length ? proIds : ["00000000-0000-0000-0000-000000000000"]);
  const proTierOk = new Set(
    (pros || [])
      .filter((p) => String(p.subscription_tier || "").toLowerCase() === "pro")
      .map((p) => p.id),
  );

  const toNotify = candidates.filter((c) => proTierOk.has(c.pro_profile_id));
  const outcomes: { booking_id: string; status: number; body?: unknown }[] = [];

  for (const b of toNotify) {
    const res = await fetch(`${supabaseUrl}/functions/v1/booking-sms-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        "x-booking-reminder-secret": expected,
      },
      body: JSON.stringify({ booking_id: b.id, event: "reminder" }),
    });
    const bodyJson = await res.json().catch(() => ({}));
    outcomes.push({ booking_id: b.id, status: res.status, body: bodyJson });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: (rows || []).length,
      in_window: candidates.length,
      notified: toNotify.length,
      outcomes,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

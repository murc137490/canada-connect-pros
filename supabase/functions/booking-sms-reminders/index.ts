/**
 * Hourly cron (pg_cron + pg_net). Pro-tier only:
 * - Appointment reminders at 24 / 48 / 72h before preferred_date (pro prefs)
 * - Review-request SMS after preferred_date has passed (same day evening+)
 *
 * Auth: x-booking-reminder-secret === BOOKING_REMINDER_SECRET
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(baseYmd: string, days: number): string {
  const d = new Date(`${baseYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
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

  const secret = req.headers.get("x-booking-reminder-secret");
  const expected = Deno.env.get("BOOKING_REMINDER_SECRET");
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const today = ymd(new Date());
  const date24 = addDaysYmd(today, 1);
  const date48 = addDaysYmd(today, 2);
  const date72 = addDaysYmd(today, 3);

  const { data: candidates, error } = await admin
    .from("bookings")
    .select("id, preferred_date, status, sms_reminder_sent_at, sms_review_request_sent_at, pro_profile_id")
    .in("status", ["pending", "accepted", "completed"])
    .or(
      `and(preferred_date.in.(${date24},${date48},${date72}),sms_reminder_sent_at.is.null),and(preferred_date.lt.${today},sms_review_request_sent_at.is.null,status.eq.completed)`,
    )
    .limit(80);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = candidates ?? [];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const proIds = [...new Set(rows.map((r) => r.pro_profile_id).filter(Boolean))];
  const { data: pros } = await admin
    .from("pro_profiles")
    .select("id, subscription_tier, sms_reminder_hours")
    .in("id", proIds);

  const proMap = new Map(
    (pros ?? []).map((p) => [
      p.id as string,
      {
        tier: ((p.subscription_tier ?? "starter") as string).toLowerCase(),
        hours: (p.sms_reminder_hours as number | null) ?? 24,
      },
    ]),
  );

  const hoursToDate: Record<number, string> = { 24: date24, 48: date48, 72: date72 };
  const notifyUrl = `${supabaseUrl}/functions/v1/booking-sms-notify`;
  const results: { id: string; event: string; status: number }[] = [];

  for (const row of rows) {
    const meta = proMap.get(row.pro_profile_id as string);
    if (!meta || meta.tier !== "pro") continue;

    const pref = String(row.preferred_date ?? "");
    let event: "reminder" | "review_request" | null = null;

    if (!row.sms_reminder_sent_at && (pref === date24 || pref === date48 || pref === date72)) {
      const expectedDate = hoursToDate[meta.hours] ?? date24;
      if (pref === expectedDate) event = "reminder";
    } else if (
      !row.sms_review_request_sent_at &&
      row.status === "completed" &&
      pref &&
      pref < today
    ) {
      event = "review_request";
    }

    if (!event) continue;

    const res = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        "x-booking-reminder-secret": expected,
      },
      body: JSON.stringify({ booking_id: row.id, event }),
    });
    results.push({ id: row.id as string, event, status: res.status });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

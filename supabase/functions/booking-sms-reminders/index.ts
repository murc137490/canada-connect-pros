/**
 * Hourly cron (pg_cron + pg_net, secret read from Vault at run time). Pro tier only:
 *  - Appointment reminder for ACCEPTED bookings, 1/2/3 days ahead (pro's sms_reminder_hours 24/48/72)
 *  - Review request for COMPLETED bookings dated in the last 7 days (skipped if already reviewed)
 * Dates and quiet hours use Quebec time (America/Toronto). Texts go out 09:00–20:59 only.
 *
 * Auth: x-booking-reminder-secret (Vault or env BOOKING_REMINDER_SECRET) or service-role bearer.
 * Body: { "dry_run": true, "ignore_quiet_hours": true } -> lists what would be sent, sends nothing.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalRequest } from "../_shared/internalAuth.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TZ = "America/Toronto";
const QUIET_START = 21; // no texts from 21:00
const QUIET_END = 9; // until 09:00
const REVIEW_WINDOW_DAYS = 7;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function localParts(now: Date): { ymd: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function addDaysYmd(baseYmd: string, days: number): string {
  const d = new Date(`${baseYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(withCorsAllowlist(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  if (!(await isInternalRequest(req, admin))) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const ignoreQuiet = dryRun && body?.ignore_quiet_hours === true;

  const { ymd: today, hour } = localParts(new Date());
  if (!ignoreQuiet && (hour >= QUIET_START || hour < QUIET_END)) {
    return json({ ok: true, skipped: true, reason: "quiet_hours", local_date: today, local_hour: hour });
  }

  const dayAhead: Record<number, string> = { 24: addDaysYmd(today, 1), 48: addDaysYmd(today, 2), 72: addDaysYmd(today, 3) };
  const reviewFrom = addDaysYmd(today, -REVIEW_WINDOW_DAYS);

  const { data: candidates, error } = await admin
    .from("bookings")
    .select("id, preferred_date, status, pro_profile_id")
    .or(
      `and(status.eq.accepted,preferred_date.in.(${dayAhead[24]},${dayAhead[48]},${dayAhead[72]}),sms_reminder_sent_at.is.null),` +
        `and(status.eq.completed,preferred_date.gte.${reviewFrom},preferred_date.lt.${today},sms_review_request_sent_at.is.null)`,
    )
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  const rows = candidates ?? [];
  const proIds = [...new Set(rows.map((r) => r.pro_profile_id).filter(Boolean))];
  const { data: pros } = proIds.length
    ? await admin.from("pro_profiles").select("id, sms_reminder_hours").in("id", proIds)
    : { data: [] };
  const hoursByPro = new Map((pros ?? []).map((p) => [p.id as string, (p.sms_reminder_hours as number | null) ?? 24]));

  const notifyUrl = `${supabaseUrl}/functions/v1/booking-sms-notify`;
  const results: { id: string; event: string; status: number; result?: unknown }[] = [];

  for (const row of rows) {
    const pref = String(row.preferred_date ?? "");
    let event: "reminder" | "review_request" | null = null;
    if (row.status === "accepted") {
      const hours = hoursByPro.get(row.pro_profile_id as string) ?? 24;
      if (pref === (dayAhead[hours] ?? dayAhead[24])) event = "reminder";
    } else if (row.status === "completed") {
      event = "review_request";
    }
    if (!event) continue;

    // Tier, language, phones, dedupe and review checks happen in booking-sms-notify.
    const res = await fetch(notifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
      body: JSON.stringify({ booking_id: row.id, event, dry_run: dryRun }),
    });
    const result = await res.json().catch(() => null);
    results.push({ id: row.id as string, event, status: res.status, result });
  }

  return json({ ok: true, dry_run: dryRun, local_date: today, local_hour: hour, candidates: rows.length, processed: results.length, results });
}));

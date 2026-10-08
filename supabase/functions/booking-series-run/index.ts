/**
 * Automatic repeat bookings (Growth & Pro). Hourly cron (pg_cron + pg_net, secret from Vault).
 * Creates the next booking request for active series up to 7 days ahead (SQL: booking_series_generate_due),
 * then sends the normal notifications for each new booking:
 *  - email to the client (booking_created / booking_confirmed when the pro auto-approves)
 *  - Pro-tier SMS (request / confirmation) through booking-sms-notify
 * No card is ever charged here: the client pays from the dashboard like any accepted booking.
 *
 * Auth: x-booking-reminder-secret (Vault / env) or service-role bearer.
 * Body: { "dry_run": true } -> returns what would be created; writes and sends nothing.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalRequest } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Generated = { series_id: string; booking_id?: string; date?: string; status?: string; skipped?: string; would_create?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  if (!(await isInternalRequest(req, admin))) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  const { data, error } = await admin.rpc("booking_series_generate_due", { p_dry_run: dryRun, p_horizon_days: 7 });
  if (error) return json({ error: error.message }, 500);
  const rows = (Array.isArray(data) ? data : []) as Generated[];
  if (dryRun) return json({ ok: true, dry_run: true, planned: rows });

  const notifications: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (!r.booking_id) continue;
    const confirmed = r.status === "accepted";
    const call = (slug: string, payload: Record<string, unknown>) =>
      fetch(`${supabaseUrl}/functions/v1/${slug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.status)
        .catch(() => 0);
    const [emailStatus, smsStatus] = await Promise.all([
      call("send-app-email", { type: confirmed ? "booking_confirmed" : "booking_created", booking_id: r.booking_id }),
      call("booking-sms-notify", { booking_id: r.booking_id, event: confirmed ? "confirmation" : "request" }),
    ]);
    notifications.push({ booking_id: r.booking_id, email_status: emailStatus, sms_status: smsStatus });
  }
  return json({ ok: true, dry_run: false, generated: rows, notifications });
});

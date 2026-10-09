/**
 * Pro-tier booking SMS (Telnyx, Twilio fallback). Events:
 *  - request        pending booking acknowledgement (client + pro)        once per booking
 *  - confirmation   booking accepted (client + pro)                         once per booking
 *  - reminder       24/48/72h before the date (client + pro), cron only
 *  - review_request after a completed job (client only), cron only
 * Callers sending event "confirmation" for a still-pending booking get the "request" text.
 *
 * Auth:
 *  - internal: service-role bearer or cron secret (any event; supports dry_run)
 *  - signed-in user: booking's client or the booking's pro (request/confirmation only)
 *  - phone front desk (anon key): only for the booking created in a recently OTP-verified
 *    front_desk_sessions row for that same customer (request/confirmation only)
 * Language: each recipient's saved language (profiles.email_language / pro_profiles.email_language).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toE164NorthAmerica } from "../_shared/phoneE164.ts";
import { sendTelnyxSms, telnyxSmsConfigured } from "../_shared/telnyxSms.ts";
import { buildSmsText, formatSmsDate, smsLang, type SmsEvent } from "../_shared/bookingSmsTemplates.ts";
import { isInternalRequest } from "../_shared/internalAuth.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = "https://www.altshift.ca";
const FRONT_DESK_WINDOW_MS = 2 * 60 * 60 * 1000;
const REVIEW_WINDOW_DAYS = 7;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function twilioSmsConfigured(): boolean {
  return !!(
    Deno.env.get("TWILIO_ACCOUNT_SID")?.trim() &&
    Deno.env.get("TWILIO_AUTH_TOKEN")?.trim() &&
    Deno.env.get("TWILIO_SMS_FROM")?.trim()
  );
}

async function sendTwilioSms(to: string, text: string): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", Deno.env.get("TWILIO_SMS_FROM")!);
  form.set("Body", text);
  const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const twData = await twRes.json().catch(() => ({}));
  if (!twRes.ok) return { ok: false, error: (twData as { message?: string }).message ?? "twilio_error" };
  return { ok: true, sid: (twData as { sid?: string }).sid ?? "" };
}

function parseEvent(raw: unknown): SmsEvent {
  if (raw === "reminder" || raw === "review_request" || raw === "request") return raw;
  return "confirmation";
}

function maskPhone(e164: string): string {
  return e164.length > 4 ? `${e164.slice(0, 2)}******${e164.slice(-4)}` : "****";
}

Deno.serve(withCorsAllowlist(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return json({ error: "Server misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => ({}));
  const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
  let event = parseEvent(body.event);
  if (!bookingId) return json({ error: "Missing booking_id" }, 400);

  const internal = await isInternalRequest(req, admin);
  const dryRun = internal && body.dry_run === true;

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select(
      "id, client_id, pro_profile_id, status, preferred_date, preferred_time, sms_reminder_sent_at, sms_review_request_sent_at, sms_request_sent_at, sms_confirmation_sent_at",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking) return json({ error: "Booking not found" }, 404);

  const { data: proRow } = await admin
    .from("pro_profiles")
    .select(
      "business_name, subscription_tier, user_id, phone, email_language, sms_confirmation_message_custom, sms_reminder_message_custom, sms_review_request_message_custom",
    )
    .eq("id", booking.pro_profile_id)
    .maybeSingle();

  if (!internal) {
    if (event !== "confirmation" && event !== "request") return json({ error: "Forbidden" }, 403);
    let allowed = false;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        allowed = user.id === booking.client_id || (!!proRow?.user_id && user.id === proRow.user_id);
        if (!allowed) return json({ error: "Forbidden" }, 403);
      }
    }
    if (!allowed) {
      // Phone front desk: anon caller, booking must belong to a recent OTP-verified session.
      const since = new Date(Date.now() - FRONT_DESK_WINDOW_MS).toISOString();
      const { data: sessions } = await admin
        .from("front_desk_sessions")
        .select("id, active_booking_id, draft, customer_user_id")
        .eq("authenticated", true)
        .eq("customer_user_id", booking.client_id)
        .gte("updated_at", since)
        .limit(10);
      allowed = (sessions ?? []).some((s) =>
        s.active_booking_id === booking.id ||
        (s.draft as { last_booking?: { id?: string } } | null)?.last_booking?.id === booking.id
      );
    }
    if (!allowed) return json({ error: "Unauthorized" }, 401);
  }

  // Status decides the actual message.
  if (event === "confirmation" && booking.status === "pending") event = "request";
  const needStatus: Record<SmsEvent, string> = {
    request: "pending",
    confirmation: "accepted",
    reminder: "accepted",
    review_request: "completed",
  };
  if (booking.status !== needStatus[event]) {
    return json({ ok: true, skipped: true, reason: `status_${booking.status}_not_${needStatus[event]}` });
  }
  const sentCol: Record<SmsEvent, string> = {
    request: "sms_request_sent_at",
    confirmation: "sms_confirmation_sent_at",
    reminder: "sms_reminder_sent_at",
    review_request: "sms_review_request_sent_at",
  };
  if ((booking as Record<string, unknown>)[sentCol[event]]) {
    return json({ ok: true, skipped: true, reason: "already_sent" });
  }

  // Effective tier: billing row wins (same rule as the app), else profile column.
  const { data: sub } = proRow?.user_id
    ? await admin.from("pro_subscriptions").select("plan_id").eq("user_id", proRow.user_id).maybeSingle()
    : { data: null };
  const tier = String(sub?.plan_id ?? proRow?.subscription_tier ?? "hold").trim().toLowerCase();
  if (tier !== "pro") return json({ ok: true, skipped: true, reason: "not_pro_tier", tier });

  if (event === "review_request") {
    const pref = String(booking.preferred_date ?? "");
    const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    if (!pref || pref < cutoff) return json({ ok: true, skipped: true, reason: "review_window_passed" });
    const { count } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("pro_profile_id", booking.pro_profile_id)
      .eq("reviewer_id", booking.client_id)
      .gte("created_at", `${pref}T00:00:00Z`);
    if ((count ?? 0) > 0) return json({ ok: true, skipped: true, reason: "already_reviewed" });
  }

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("phone, full_name, email_language")
    .eq("user_id", booking.client_id)
    .maybeSingle();

  let proPhoneRaw = typeof proRow?.phone === "string" ? proRow.phone.trim() : "";
  let proLangRaw: unknown = proRow?.email_language;
  if (proRow?.user_id) {
    const { data: proUserProfile } = await admin.from("profiles").select("phone, email_language").eq("user_id", proRow.user_id).maybeSingle();
    if (!proPhoneRaw) proPhoneRaw = typeof proUserProfile?.phone === "string" ? proUserProfile.phone.trim() : "";
    if (!proLangRaw) proLangRaw = proUserProfile?.email_language;
  }

  const clientTo = toE164NorthAmerica(typeof clientProfile?.phone === "string" ? clientProfile.phone.trim() : "");
  const proTo = toE164NorthAmerica(proPhoneRaw);
  if (event === "review_request" && !clientTo) return json({ ok: true, skipped: true, reason: "no_client_phone" });
  if (!clientTo && !proTo) return json({ ok: true, skipped: true, reason: "no_phones" });

  const clientLang = smsLang(clientProfile?.email_language);
  const proLang = smsLang(proLangRaw);
  const ymd = booking.preferred_date ? String(booking.preferred_date) : "";
  const timePart = booking.preferred_time && /^\d{1,2}:\d{2}/.test(String(booking.preferred_time))
    ? String(booking.preferred_time).slice(0, 5)
    : "";
  const base = {
    businessName: proRow?.business_name ?? "",
    clientName: (clientProfile?.full_name as string | undefined)?.trim() || "",
    timePart,
  };
  const custom =
    event === "confirmation"
      ? proRow?.sms_confirmation_message_custom
      : event === "reminder"
        ? proRow?.sms_reminder_message_custom
        : event === "review_request"
          ? proRow?.sms_review_request_message_custom
          : null;
  const clientText = buildSmsText({
    event,
    forRole: "client",
    customBody: custom,
    lang: clientLang,
    vars: { ...base, datePart: formatSmsDate(ymd, clientLang), reviewUrl: `${SITE_URL}/dashboard` },
  });
  const proText = buildSmsText({
    event,
    forRole: "pro",
    customBody: null,
    lang: proLang,
    vars: { ...base, datePart: formatSmsDate(ymd, proLang), reviewUrl: `${SITE_URL}/dashboard` },
  });

  const planned: { role: "client" | "pro"; to: string; text: string; lang: string }[] = [];
  if (clientTo) planned.push({ role: "client", to: clientTo, text: clientText, lang: clientLang });
  if (event !== "review_request" && proTo && proTo !== clientTo) planned.push({ role: "pro", to: proTo, text: proText, lang: proLang });

  const useTelnyx = telnyxSmsConfigured();
  const useTwilio = twilioSmsConfigured();
  const provider = useTelnyx ? "telnyx" : useTwilio ? "twilio" : "none";

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      event,
      provider,
      would_send: planned.map((p) => ({ role: p.role, to: maskPhone(p.to), lang: p.lang, text: p.text })),
    });
  }
  if (provider === "none") return json({ ok: true, skipped: true, reason: "sms_provider_not_configured" });

  type SendResult = { role: "client" | "pro"; to: string; ok: boolean; id?: string; error?: string; provider: string };
  const results: SendResult[] = [];
  for (const p of planned) {
    if (useTelnyx) {
      const r = await sendTelnyxSms({ to: p.to, text: p.text });
      results.push({ role: p.role, to: maskPhone(p.to), ok: r.ok, id: r.ok ? r.id : undefined, error: r.ok ? undefined : r.error, provider });
    } else {
      const r = await sendTwilioSms(p.to, p.text);
      results.push({ role: p.role, to: maskPhone(p.to), ok: r.ok, id: r.ok ? r.sid : undefined, error: r.ok ? undefined : r.error, provider });
    }
  }

  const anyOk = results.some((r) => r.ok);
  const anyFail = results.some((r) => !r.ok);
  if (anyOk) {
    await admin.from("bookings").update({ [sentCol[event]]: new Date().toISOString() }).eq("id", bookingId);
  }
  return json({ ok: anyOk && !anyFail ? true : anyOk, partial: anyOk && anyFail, event, results }, anyOk ? 200 : 502);
}));

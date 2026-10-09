/**
 * Returning-customer reminders (Growth & Pro). Hourly cron (pg_cron + pg_net, secret from Vault).
 *
 * For every pro who turned on "suggest rebooking after X weeks", clients whose last completed visit is due
 * get ONE nudge per cycle (cycle = their latest completed booking with that pro) with a Book Again link.
 *  - Channel: SMS if the pro is on Pro (SMS tier) and the client has a mobile number; email otherwise.
 *  - Skipped when the client opted out, already has an upcoming booking / repeat booking with that pro.
 *  - Quebec time (America/Toronto); messages only go out 10:00–19:59.
 *  - EN/FR from the client's language setting. SMS carry the STOP line; emails carry an unsubscribe link.
 *
 * Auth: x-booking-reminder-secret (Vault / env) or service-role bearer.
 * Body: { "dry_run": true, "ignore_quiet_hours": true, "pro_profile_id": "..." } -> lists, sends nothing.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalRequest } from "../_shared/internalAuth.ts";
import { brandFrom, BRAND_REPLY_TO } from "../_shared/brandSender.ts";
import { sendTelnyxSms, telnyxSmsConfigured } from "../_shared/telnyxSms.ts";
import { toE164NorthAmerica } from "../_shared/phoneE164.ts";
import { SMS_SUPPORT_FOOTER, smsLang, type SmsLang } from "../_shared/bookingSmsTemplates.ts";
import { emailParagraph, emailPrimaryButton, emailSecondaryNote, emailShell } from "../_shared/premiereEmail.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TZ = "America/Toronto";
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 20; // exclusive
const SITE_URL_ENV = (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const SITE_URL = /^https:\/\/(www\.)?altshift\.ca$/i.test(SITE_URL_ENV) ? SITE_URL_ENV : "https://www.altshift.ca";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function localHour(now: Date): number {
  const h = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h);
}

function maskPhone(e164: string): string {
  return e164.length > 6 ? `${e164.slice(0, 2)}******${e164.slice(-4)}` : "***";
}
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email[0]}***${email.slice(at)}` : "***";
}

function serviceLabel(slug: string | null): string {
  return (slug ?? "").replace(/[-_]+/g, " ").trim();
}

export function rebookSmsText(lang: SmsLang, businessName: string, service: string, link: string): string {
  const svc = service ? (lang === "fr" ? ` (${service})` : ` (${service})`) : "";
  const body =
    lang === "fr"
      ? `AltShift : c'est peut-être le moment de réserver de nouveau avec ${businessName}${svc}. Réservez en un clic : ${link}`
      : `AltShift: it may be time to book ${businessName} again${svc}. Book again in one tap: ${link}`;
  return `${body} ${SMS_SUPPORT_FOOTER[lang]}`;
}

export function rebookEmail(lang: SmsLang, name: string, businessName: string, service: string, link: string, unsubscribeUrl: string) {
  const hello = name ? (lang === "fr" ? `Bonjour ${name},` : `Hi ${name},`) : lang === "fr" ? "Bonjour," : "Hi,";
  const subject = lang === "fr" ? `Prêt à réserver de nouveau avec ${businessName} ?` : `Ready to book ${businessName} again?`;
  const body =
    emailParagraph(hello) +
    emailParagraph(
      lang === "fr"
        ? `Votre dernier rendez-vous avec ${businessName}${service ? ` (${service})` : ""} remonte à un moment. Vous pouvez réserver de nouveau avec le même professionnel en un clic.`
        : `It has been a while since your last visit with ${businessName}${service ? ` (${service})` : ""}. You can book the same professional again in one click.`,
    ) +
    emailPrimaryButton(lang === "fr" ? "Réserver à nouveau" : "Book again", link) +
    emailSecondaryNote(
      lang === "fr"
        ? `Vous recevez ce rappel parce que vous avez déjà réservé ${businessName} sur AltShift. Ne plus recevoir ces rappels : ${unsubscribeUrl}`
        : `You are getting this reminder because you booked ${businessName} on AltShift before. Stop these reminders: ${unsubscribeUrl}`,
    );
  const html = emailShell({
    language: lang,
    preheader: subject,
    eyebrow: lang === "fr" ? "Rappel" : "Reminder",
    title: subject,
    bodyHtml: body,
    siteUrl: SITE_URL,
    termsUrl: `${SITE_URL}/terms`,
    privacyUrl: `${SITE_URL}/privacy`,
    supportEmail: BRAND_REPLY_TO,
  });
  return { subject, html };
}

type Candidate = {
  pro_profile_id: string;
  client_id: string;
  anchor_booking_id: string;
  last_visit: string;
  due_date: string;
  tier: string;
  service_category_slug: string | null;
  service_slug: string | null;
  attempts: number;
};

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
  const onlyPro = typeof body?.pro_profile_id === "string" ? body.pro_profile_id : null;

  const hour = localHour(new Date());
  if (!ignoreQuiet && (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR)) {
    return json({ ok: true, skipped: true, reason: "quiet_hours", local_hour: hour });
  }

  const { data, error } = await admin.rpc("rebook_reminder_candidates", { p_limit: 200 });
  if (error) return json({ error: error.message }, 500);
  let candidates = (data ?? []) as Candidate[];
  if (onlyPro) candidates = candidates.filter((c) => c.pro_profile_id === onlyPro);

  const proIds = [...new Set(candidates.map((c) => c.pro_profile_id))];
  const clientIds = [...new Set(candidates.map((c) => c.client_id))];
  const [{ data: pros }, { data: clients }] = await Promise.all([
    proIds.length
      ? admin.from("pro_profiles").select("id, business_name").in("id", proIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string | null }[] }),
    clientIds.length
      ? admin.from("profiles").select("user_id, full_name, phone, email_language").in("user_id", clientIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; phone: string | null; email_language: string | null }[] }),
  ]);
  const proName = new Map((pros ?? []).map((p) => [p.id, (p.business_name ?? "").trim() || "your professional"]));
  const clientById = new Map((clients ?? []).map((c) => [c.user_id, c]));
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const smsReady = telnyxSmsConfigured();

  const results: Record<string, unknown>[] = [];
  for (const c of candidates) {
    const client = clientById.get(c.client_id);
    const lang = smsLang(client?.email_language);
    const businessName = proName.get(c.pro_profile_id) ?? "your professional";
    const service = serviceLabel(c.service_slug);
    const link = `${SITE_URL}/book-again/${c.anchor_booking_id}`;
    const phone = toE164NorthAmerica(String(client?.phone ?? ""));
    const channel: "sms" | "email" = c.tier === "pro" && phone && smsReady ? "sms" : "email";

    let email = "";
    if (channel === "email") {
      const { data: u } = await admin.auth.admin.getUserById(c.client_id);
      email = u?.user?.email ?? "";
      if (!email) {
        results.push({ anchor_booking_id: c.anchor_booking_id, skipped: "no_contact" });
        continue;
      }
    }

    if (dryRun) {
      results.push({
        anchor_booking_id: c.anchor_booking_id,
        pro_profile_id: c.pro_profile_id,
        due_date: c.due_date,
        channel,
        lang,
        to: channel === "sms" ? maskPhone(phone!) : maskEmail(email),
        preview: channel === "sms" ? rebookSmsText(lang, businessName, service, link) : rebookEmail(lang, "", businessName, service, link, `${SITE_URL}/unsubscribe/rebook?token=…`).subject,
      });
      continue;
    }

    // Claim the cycle first (unique per pro+client+anchor) so parallel runs can never double-send.
    const { data: existing } = await admin
      .from("rebook_nudges")
      .select("id, status, attempts, unsubscribe_token")
      .eq("pro_profile_id", c.pro_profile_id)
      .eq("client_id", c.client_id)
      .eq("anchor_booking_id", c.anchor_booking_id)
      .maybeSingle();
    let nudgeId: string;
    let token: string;
    if (existing) {
      if (existing.status !== "failed") continue;
      const { data: claimed } = await admin
        .from("rebook_nudges")
        .update({ status: "sending", attempts: (existing.attempts ?? 1) + 1, channel, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "failed")
        .select("id, unsubscribe_token")
        .maybeSingle();
      if (!claimed) continue;
      nudgeId = claimed.id;
      token = claimed.unsubscribe_token;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("rebook_nudges")
        .insert({
          pro_profile_id: c.pro_profile_id,
          client_id: c.client_id,
          anchor_booking_id: c.anchor_booking_id,
          due_date: c.due_date,
          channel,
          status: "sending",
        })
        .select("id, unsubscribe_token")
        .single();
      if (insErr || !inserted) continue; // another run claimed it
      nudgeId = inserted.id;
      token = inserted.unsubscribe_token;
    }

    let ok = false;
    let err = "";
    if (channel === "sms") {
      const sent = await sendTelnyxSms({ to: phone!, text: rebookSmsText(lang, businessName, service, link) });
      ok = sent.ok;
      if (!sent.ok) err = sent.error;
    } else if (resendKey) {
      const firstName = String(client?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
      const unsubscribeUrl = `${SITE_URL}/unsubscribe/rebook?token=${token}`;
      const msg = rebookEmail(lang, firstName, businessName, service, link, unsubscribeUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: brandFrom(Deno.env.get("FROM_EMAIL")),
          to: [email],
          reply_to: BRAND_REPLY_TO,
          subject: msg.subject,
          html: msg.html,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        }),
      });
      ok = res.ok;
      if (!res.ok) err = `resend_${res.status}`;
    } else {
      err = "email_not_configured";
    }

    await admin
      .from("rebook_nudges")
      .update({ status: ok ? "sent" : "failed", error: ok ? null : err.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", nudgeId);
    results.push({ anchor_booking_id: c.anchor_booking_id, channel, sent: ok, error: ok ? undefined : err });
  }

  return json({ ok: true, dry_run: dryRun, local_hour: hour, candidates: candidates.length, results });
}));

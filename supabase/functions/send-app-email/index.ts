import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callerIsPlatformModerator, getPlatformAdminEmails } from "../_shared/platformAdmin.ts";

type Language = "en" | "fr";
type EmailType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder"
  | "support_receipt"
  | "admin_new_booking"
  | "auth_confirm_signup"
  | "auth_reset_password"
  | "auth_magic_link";

type TemplateVars = Record<string, string | number | null | undefined>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-email-pipeline-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "support@premiereservices.ca";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "Premiere Services";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "support@premiereservices.ca";
const SITE_URL = trimTrailingSlash(Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "https://premiereservices.ca");
const ADMIN_EMAIL =
  Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ??
  Deno.env.get("ADMIN_EMAIL") ??
  getPlatformAdminEmails()[0] ??
  "";
const EMAIL_PIPELINE_SECRET = Deno.env.get("EMAIL_PIPELINE_SECRET");
const DEFAULT_TIMEZONE = Deno.env.get("DEFAULT_TIMEZONE") ?? "America/Toronto";
const SUPPORT_HOURS_EN = Deno.env.get("SUPPORT_HOURS_EN") ?? "Mon-Fri, 8am-8pm EST";
const SUPPORT_HOURS_FR = Deno.env.get("SUPPORT_HOURS_FR") ?? "Lun.-ven., 8 h-20 h HNE";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "Missing RESEND_API_KEY" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "Server misconfigured" }, 500);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const incomingVars = baseVariables(body.variables);
    const type = normalizeEmailType(body.type);
    if (!type) return json({ error: "Invalid or missing type" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const caller = await getCaller(req, supabaseUrl, anonKey);
    const hasPipelineSecret =
      Boolean(EMAIL_PIPELINE_SECRET) && req.headers.get("x-email-pipeline-secret") === EMAIL_PIPELINE_SECRET;

    if (!caller && !hasPipelineSecret) return json({ error: "Unauthorized" }, 401);

    let toEmail = "";
    let language: Language = "en";
    let variables: TemplateVars = { ...incomingVars };

    if (type.startsWith("booking_") || type === "admin_new_booking") {
      const bookingId = stringOrNull(body.booking_id ?? incomingVars.booking_id);
      if (!bookingId) return json({ error: "Missing booking_id" }, 400);

      const bookingContext = await loadBookingContext(adminClient, bookingId, variables);
      if (!bookingContext) return json({ error: "Booking not found" }, 404);
      if (
        !hasPipelineSecret &&
        caller &&
        !(await canAccessBooking(adminClient, caller.id, caller.email, bookingContext))
      ) {
        return json({ error: "Forbidden" }, 403);
      }

      variables = { ...variables, ...bookingContext.variables };
      if (type === "admin_new_booking") {
        toEmail = ADMIN_EMAIL;
        language = resolveLanguage(
          explicitLanguageFromBody(body) ?? Deno.env.get("ADMIN_EMAIL_LANGUAGE"),
          "en",
        );
      } else {
        toEmail = bookingContext.clientEmail;
        language = resolveLanguage(explicitLanguageFromBody(body), bookingContext.clientLanguage);
      }
    } else if (type === "support_receipt") {
      const recipient = await resolveRecipient(adminClient, body, caller, hasPipelineSecret);
      if (!recipient.email) return json({ error: "Missing recipient email" }, 400);
      toEmail = recipient.email;
      language = resolveLanguage(explicitLanguageFromBody(body), recipient.language);
      variables = { ...variables, ...recipient.variables };
    } else {
      if (!hasPipelineSecret) return json({ error: "Auth template sends require x-email-pipeline-secret" }, 403);
      const recipient = await resolveRecipient(adminClient, body, caller, true);
      if (!recipient.email) return json({ error: "Missing recipient email" }, 400);
      toEmail = recipient.email;
      language = resolveLanguage(explicitLanguageFromBody(body), recipient.language);
      variables = { ...variables, ...recipient.variables };
    }

    const rendered = renderTemplate(type, language, variables);
    const result = await sendViaResend(toEmail, rendered.subject, rendered.html);
    if (!result.ok) return json({ error: "Resend failed", details: result.details }, 502);

    return json({ ok: true, email_sent: true, type, language, to: toEmail });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function getCaller(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data } = await userClient.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}

async function loadBookingContext(adminClient: ReturnType<typeof createClient>, bookingId: string, overrides: TemplateVars) {
  const { data: booking, error } = await adminClient
    .from("bookings")
    .select("id, pro_profile_id, client_id, status, created_at, preferred_date, preferred_time, service_duration_minutes, decline_reason")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) return null;

  const [{ data: pro }, { data: clientProfile }, { data: authUser }, payment] = await Promise.all([
    adminClient.from("pro_profiles").select("id, user_id, business_name, location").eq("id", booking.pro_profile_id).maybeSingle(),
    adminClient.from("profiles").select("full_name, phone, email_language").eq("user_id", booking.client_id).maybeSingle(),
    adminClient.auth.admin.getUserById(booking.client_id),
    latestPayment(adminClient, booking.id),
  ]);

  const clientEmail = authUser?.user?.email ?? "";
  const clientLanguage = normalizeLanguage(clientProfile?.email_language ?? authUser?.user?.user_metadata?.email_language ?? "en");
  const bookingDate = String(overrides.booking_date ?? formatDate(booking.preferred_date ?? booking.created_at, clientLanguage));
  const bookingTime = String(overrides.booking_time ?? formatTime(booking.preferred_time, clientLanguage));
  const amountPaid = String(overrides.amount_paid ?? formatMoney(payment?.amount_cents, payment?.currency ?? "CAD"));

  return {
    booking,
    clientEmail,
    clientLanguage,
    proUserId: pro?.user_id ?? "",
    variables: {
      name: clientProfile?.full_name ?? authUser?.user?.user_metadata?.full_name ?? clientEmail,
      client_name: clientProfile?.full_name ?? clientEmail,
      client_email: clientEmail,
      client_phone: clientProfile?.phone ?? "",
      pro_name: pro?.business_name ?? "Premiere Services Pro",
      booking_id: booking.id,
      booking_date: bookingDate,
      booking_time: bookingTime,
      timezone: String(overrides.timezone ?? DEFAULT_TIMEZONE),
      booking_location: overrides.booking_location ?? pro?.location ?? "",
      service_type: overrides.service_type ?? "Service",
      amount_paid: amountPaid,
      payment_status: overrides.payment_status ?? payment?.status ?? "",
      booking_status: booking.status,
      cancellation_reason: overrides.cancellation_reason ?? booking.decline_reason ?? "",
      reminder_window: overrides.reminder_window ?? "soon",
      manage_booking_url: overrides.manage_booking_url ?? `${SITE_URL}/dashboard?tab=bookings`,
      admin_booking_url: overrides.admin_booking_url ?? `${SITE_URL}/dashboard?tab=admin`,
      support_hours: clientLanguage === "fr" ? SUPPORT_HOURS_FR : SUPPORT_HOURS_EN,
      terms_url: overrides.terms_url ?? `${SITE_URL}/terms`,
      privacy_url: overrides.privacy_url ?? `${SITE_URL}/privacy`,
      cancellation_policy_url: overrides.cancellation_policy_url ?? `${SITE_URL}/terms`,
      reschedule_policy_url: overrides.reschedule_policy_url ?? `${SITE_URL}/terms`,
    },
  };
}

async function latestPayment(adminClient: ReturnType<typeof createClient>, bookingId: string) {
  const { data } = await adminClient
    .from("payments")
    .select("amount_cents, currency, status, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { amount_cents: number | null; currency: string | null; status: string | null } | null;
}

async function canAccessBooking(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
  ctx: Awaited<ReturnType<typeof loadBookingContext>>,
) {
  if (!ctx) return false;
  if (await callerIsPlatformModerator(adminClient, userId, userEmail)) return true;
  return ctx.booking.client_id === userId || ctx.proUserId === userId;
}

async function resolveRecipient(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  caller: { id: string; email: string } | null,
  allowExplicitEmail: boolean
) {
  const userId = stringOrNull(body.recipient_user_id);
  const vars = baseVariables(body.variables);
  let email = allowExplicitEmail ? stringOrNull(body.to_email ?? body.email) ?? "" : "";
  let name = stringOrNull(body.name) ?? "";
  let language = normalizeLanguage(body.language);

  if (userId) {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      adminClient.from("profiles").select("full_name, email_language").eq("user_id", userId).maybeSingle(),
      adminClient.auth.admin.getUserById(userId),
    ]);
    email = authUser?.user?.email ?? email;
    name = profile?.full_name ?? authUser?.user?.user_metadata?.full_name ?? name;
    language = normalizeLanguage(profile?.email_language ?? authUser?.user?.user_metadata?.email_language ?? language);
  } else if (caller && !allowExplicitEmail) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, email_language")
      .eq("user_id", caller.id)
      .maybeSingle();
    email = caller.email;
    name = profile?.full_name ?? name;
    language = normalizeLanguage(profile?.email_language ?? language);
  }

  return {
    email,
    language,
    variables: {
      name: name || email,
      email,
      ticket_id: stringOrNull(body.ticket_id) ?? stringOrNull(vars.ticket_id) ?? crypto.randomUUID(),
      subject: stringOrNull(body.subject) ?? stringOrNull(vars.subject) ?? "",
      message: stringOrNull(body.message) ?? stringOrNull(vars.message) ?? "",
      submitted_date: stringOrNull(body.submitted_date) ?? new Date().toLocaleString(language === "fr" ? "fr-CA" : "en-CA"),
      confirmation_url: stringOrNull(body.confirmation_url) ?? stringOrNull(vars.confirmation_url) ?? "",
      reset_url: stringOrNull(body.reset_url) ?? stringOrNull(vars.reset_url) ?? "",
      magic_link_url: stringOrNull(body.magic_link_url) ?? stringOrNull(vars.magic_link_url) ?? "",
      expires_in: stringOrNull(body.expires_in) ?? stringOrNull(vars.expires_in) ?? "1 hour",
      support_hours: language === "fr" ? SUPPORT_HOURS_FR : SUPPORT_HOURS_EN,
      terms_url: `${SITE_URL}/terms`,
      privacy_url: `${SITE_URL}/privacy`,
    },
  };
}

function renderTemplate(type: EmailType, language: Language, vars: TemplateVars) {
  const t = copy[type][language];
  return {
    subject: replaceVars(t.subject, vars),
    html: layout(replaceVars(t.heading, vars), replaceVars(t.preheader, vars), replaceVars(t.body, vars, "html"), language, vars),
  };
}

const copy: Record<EmailType, Record<Language, { subject: string; preheader: string; heading: string; body: string }>> = {
  booking_created: {
    en: {
      subject: "Premiere Services - Booking request received",
      preheader: "Booking request received",
      heading: "Thank you for booking, {{name}}.",
      body: detailsBlock([
        ["Booking ID", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Time", "{{booking_time}} {{timezone}}"],
        ["Location", "{{booking_location}}"],
        ["Professional", "{{pro_name}}"],
      ]) + cta("Manage booking", "{{manage_booking_url}}") + paragraph("We received your booking request and will send another email once it is confirmed."),
    },
    fr: {
      subject: "Premiere Services - Demande de réservation reçue",
      preheader: "Demande de réservation reçue",
      heading: "Merci pour votre réservation, {{name}}.",
      body: detailsBlock([
        ["ID de réservation", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Heure", "{{booking_time}} {{timezone}}"],
        ["Lieu", "{{booking_location}}"],
        ["Professionnel", "{{pro_name}}"],
      ]) + cta("Gérer la réservation", "{{manage_booking_url}}") + paragraph("Nous avons bien reçu votre demande de réservation. Vous recevrez un autre courriel lorsque la réservation sera confirmée."),
    },
  },
  booking_confirmed: {
    en: {
      subject: "Premiere Services - Your booking is confirmed",
      preheader: "Your booking is confirmed",
      heading: "Hi {{name}}, your booking is confirmed.",
      body: detailsBlock([
        ["Booking ID", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Time", "{{booking_time}} {{timezone}}"],
        ["Location", "{{booking_location}}"],
        ["Professional", "{{pro_name}}"],
        ["Amount paid", "{{amount_paid}}"],
      ]) + cta("View booking details", "{{manage_booking_url}}") + paragraph("Your payment is complete or your booking has been confirmed by our team."),
    },
    fr: {
      subject: "Premiere Services - Votre réservation est confirmée",
      preheader: "Votre réservation est confirmée",
      heading: "Bonjour {{name}}, votre réservation est confirmée.",
      body: detailsBlock([
        ["ID de réservation", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Heure", "{{booking_time}} {{timezone}}"],
        ["Lieu", "{{booking_location}}"],
        ["Professionnel", "{{pro_name}}"],
        ["Montant payé", "{{amount_paid}}"],
      ]) + cta("Voir les détails", "{{manage_booking_url}}") + paragraph("Votre paiement est complété ou votre réservation a été confirmée par notre équipe."),
    },
  },
  booking_cancelled: {
    en: {
      subject: "Premiere Services - Booking cancelled",
      preheader: "Booking cancelled",
      heading: "Hi {{name}}, your booking has been cancelled.",
      body: detailsBlock([
        ["Booking ID", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Original date", "{{booking_date}}"],
        ["Original time", "{{booking_time}} {{timezone}}"],
        ["Location", "{{booking_location}}"],
        ["Reason", "{{cancellation_reason}}"],
      ]) + cta("Manage booking", "{{manage_booking_url}}") + paragraph("Refunds or rebooking options, if applicable, follow the cancellation policy."),
    },
    fr: {
      subject: "Premiere Services - Réservation annulée",
      preheader: "Réservation annulée",
      heading: "Bonjour {{name}}, votre réservation a été annulée.",
      body: detailsBlock([
        ["ID de réservation", "{{booking_id}}"],
        ["Service", "{{service_type}}"],
        ["Date originale", "{{booking_date}}"],
        ["Heure originale", "{{booking_time}} {{timezone}}"],
        ["Lieu", "{{booking_location}}"],
        ["Raison", "{{cancellation_reason}}"],
      ]) + cta("Gérer la réservation", "{{manage_booking_url}}") + paragraph("Les remboursements ou options de nouvelle réservation, si applicables, suivent notre politique d’annulation."),
    },
  },
  booking_reminder: {
    en: {
      subject: "Premiere Services - Booking reminder",
      preheader: "Booking reminder",
      heading: "Hi {{name}}, your booking is coming up {{reminder_window}}.",
      body: detailsBlock([
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Time", "{{booking_time}} {{timezone}}"],
        ["Location", "{{booking_location}}"],
        ["Professional", "{{pro_name}}"],
      ]) + cta("Manage booking", "{{manage_booking_url}}") + paragraph("If you need to cancel or reschedule, please do so as early as possible."),
    },
    fr: {
      subject: "Premiere Services - Rappel de réservation",
      preheader: "Rappel de réservation",
      heading: "Bonjour {{name}}, votre réservation approche {{reminder_window}}.",
      body: detailsBlock([
        ["Service", "{{service_type}}"],
        ["Date", "{{booking_date}}"],
        ["Heure", "{{booking_time}} {{timezone}}"],
        ["Lieu", "{{booking_location}}"],
        ["Professionnel", "{{pro_name}}"],
      ]) + cta("Gérer la réservation", "{{manage_booking_url}}") + paragraph("Si vous devez annuler ou déplacer votre réservation, veuillez le faire le plus tôt possible."),
    },
  },
  support_receipt: {
    en: {
      subject: "Premiere Services - We received your message",
      preheader: "We received your message",
      heading: "Hi {{name}}, thanks for contacting us.",
      body: paragraph("Our support team received your message and will get back to you as soon as possible.") + detailsBlock([["Ticket ID", "{{ticket_id}}"], ["Subject", "{{subject}}"], ["Submitted", "{{submitted_date}}"], ["Message", "{{message}}"]]),
    },
    fr: {
      subject: "Premiere Services - Nous avons reçu votre message",
      preheader: "Nous avons reçu votre message",
      heading: "Bonjour {{name}}, merci de nous avoir contactés.",
      body: paragraph("Notre équipe de support a bien reçu votre message et vous répondra dès que possible.") + detailsBlock([["ID du billet", "{{ticket_id}}"], ["Sujet", "{{subject}}"], ["Date d’envoi", "{{submitted_date}}"], ["Message", "{{message}}"]]),
    },
  },
  admin_new_booking: {
    en: {
      subject: "Premiere Services - New booking received",
      preheader: "Internal booking notification",
      heading: "New booking received",
      body: detailsBlock([["Booking ID", "{{booking_id}}"], ["Client", "{{client_name}}"], ["Client email", "{{client_email}}"], ["Client phone", "{{client_phone}}"], ["Professional", "{{pro_name}}"], ["Service", "{{service_type}}"], ["Date", "{{booking_date}}"], ["Time", "{{booking_time}} {{timezone}}"], ["Location", "{{booking_location}}"], ["Status", "{{booking_status}}"], ["Payment status", "{{payment_status}}"]]) + cta("Open admin booking", "{{admin_booking_url}}"),
    },
    fr: {
      subject: "Premiere Services - Nouvelle réservation reçue",
      preheader: "Notification interne",
      heading: "Nouvelle réservation reçue",
      body: detailsBlock([["ID de réservation", "{{booking_id}}"], ["Client", "{{client_name}}"], ["Courriel client", "{{client_email}}"], ["Téléphone client", "{{client_phone}}"], ["Professionnel", "{{pro_name}}"], ["Service", "{{service_type}}"], ["Date", "{{booking_date}}"], ["Heure", "{{booking_time}} {{timezone}}"], ["Lieu", "{{booking_location}}"], ["Statut", "{{booking_status}}"], ["Statut du paiement", "{{payment_status}}"]]) + cta("Ouvrir dans l’admin", "{{admin_booking_url}}"),
    },
  },
  auth_confirm_signup: authCopy("Confirm your account", "Confirmez votre compte", "Confirm email", "Confirmer mon courriel", "{{confirmation_url}}"),
  auth_reset_password: authCopy("Reset your password", "Réinitialisez votre mot de passe", "Reset password", "Réinitialiser le mot de passe", "{{reset_url}}"),
  auth_magic_link: authCopy("Sign in securely", "Connectez-vous de façon sécurisée", "Sign in", "Me connecter", "{{magic_link_url}}"),
};

function authCopy(enHeading: string, frHeading: string, enButton: string, frButton: string, url: string) {
  return {
    en: {
      subject: `Premiere Services - ${enHeading}`,
      preheader: enHeading,
      heading: `Hi {{name}}, ${enHeading.toLowerCase()}.`,
      body: paragraph("Use the secure link below for your Premiere Services account.") + cta(enButton, url) + paragraph("If you did not request this email, you can ignore it."),
    },
    fr: {
      subject: `Premiere Services - ${frHeading}`,
      preheader: frHeading,
      heading: `Bonjour {{name}}, ${frHeading.toLowerCase()}.`,
      body: paragraph("Utilisez le lien sécurisé ci-dessous pour votre compte Premiere Services.") + cta(frButton, url) + paragraph("Si vous n’avez pas demandé ce courriel, vous pouvez l’ignorer."),
    },
  };
}

function layout(heading: string, preheader: string, body: string, language: Language, vars: TemplateVars) {
  const terms = language === "fr" ? "Conditions" : "Terms";
  const privacy = language === "fr" ? "Politique de confidentialité" : "Privacy Policy";
  const support = language === "fr" ? "Support" : "Support";
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <div style="max-width:640px;margin:0 auto;padding:28px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
      <h1 style="margin:0 0 8px;font-size:24px;">Premiere Services</h1>
      <p style="margin:0 0 24px;color:#6b7280;">${escapeHtml(preheader)}</p>
      <h2 style="font-size:20px;margin:0 0 12px;">${escapeHtml(heading)}</h2>
      ${body}
      <p style="margin-top:24px;font-size:14px;color:#6b7280;">${support}: <a href="mailto:${escapeHtml(REPLY_TO_EMAIL)}">${escapeHtml(REPLY_TO_EMAIL)}</a> · ${escapeHtml(str(vars.support_hours))}</p>
      <p style="font-size:14px;color:#6b7280;">${language === "fr" ? "Annulation / replanification" : "Cancellation / reschedule"}: <a href="${escapeAttr(str(vars.cancellation_policy_url ?? `${SITE_URL}/terms`))}">${terms}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="font-size:12px;color:#9ca3af;">Premiere Services · <a href="${escapeAttr(str(vars.terms_url ?? `${SITE_URL}/terms`))}">${terms}</a> · <a href="${escapeAttr(str(vars.privacy_url ?? `${SITE_URL}/privacy`))}">${privacy}</a></p>
    </div>
  </div>
</body></html>`;
}

function detailsBlock(rows: [string, string][]) {
  return `<div style="background:#f9fafb;border-radius:12px;padding:18px;margin:22px 0;">${rows.map(([label, value]) => `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}</div>`;
}

function paragraph(text: string) {
  return `<p style="line-height:1.6;">${escapeHtml(text)}</p>`;
}

function cta(label: string, url: string) {
  return `<a href="${escapeAttr(url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">${escapeHtml(label)}</a>`;
}

function replaceVars(input: string, vars: TemplateVars, mode: "plain" | "html" = "plain") {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = str(vars[key] ?? "");
    return mode === "html" ? escapeHtml(value) : value;
  });
}

async function sendViaResend(toEmail: string, subject: string, html: string) {
  const from = FROM_NAME.trim() ? `${FROM_NAME.trim()} <${FROM_EMAIL}>` : FROM_EMAIL;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [toEmail], reply_to: REPLY_TO_EMAIL, subject, html }),
  });
  const details = await response.text().catch(() => "");
  return { ok: response.ok, details };
}

function baseVariables(raw: unknown): TemplateVars {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {
    support_hours: SUPPORT_HOURS_EN,
    terms_url: `${SITE_URL}/terms`,
    privacy_url: `${SITE_URL}/privacy`,
    cancellation_policy_url: `${SITE_URL}/terms`,
    reschedule_policy_url: `${SITE_URL}/terms`,
  };
  return raw as TemplateVars;
}

function normalizeEmailType(raw: unknown): EmailType | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value in copy ? (value as EmailType) : null;
}

function normalizeLanguage(raw: unknown): Language {
  return typeof raw === "string" && raw.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Explicit `language` or `email_language` in the request body wins; otherwise use profile/default. */
function resolveLanguage(explicit: unknown, fallback: Language): Language {
  const raw =
    typeof explicit === "string"
      ? explicit.trim().toLowerCase()
      : "";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("en")) return "en";
  return fallback;
}

function explicitLanguageFromBody(body: Record<string, unknown>): unknown {
  return body.language ?? body.email_language;
}

function stringOrNull(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function formatDate(value: string | null | undefined, language: Language) {
  if (!value) return "";
  const date = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
}

function formatTime(value: string | null | undefined, language: Language) {
  if (!value) return "";
  const [hourRaw, minuteRaw] = value.split(":");
  const date = new Date();
  date.setHours(Number(hourRaw), Number(minuteRaw ?? 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(language === "fr" ? "fr-CA" : "en-CA", { hour: "numeric", minute: "2-digit" });
}

function formatMoney(amountCents: number | null | undefined, currency: string) {
  if (typeof amountCents !== "number") return "";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(amountCents / 100);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callerIsPlatformModerator, getPlatformAdminEmails } from "../_shared/platformAdmin.ts";
import {
  emailDetails,
  emailParagraph,
  emailPrimaryButton,
  emailSecondaryNote,
  emailShell,
  type EmailLanguage,
} from "../_shared/premiereEmail.ts";

type Language = EmailLanguage;
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

type TemplateCopy = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  /** Body built with helpers; may contain {{vars}} for later substitution */
  body: string;
  showPolicyLinks?: boolean;
};

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
      expires_in: stringOrNull(body.expires_in) ?? stringOrNull(vars.expires_in) ?? (language === "fr" ? "1 heure" : "1 hour"),
      support_hours: language === "fr" ? SUPPORT_HOURS_FR : SUPPORT_HOURS_EN,
      terms_url: `${SITE_URL}/terms`,
      privacy_url: `${SITE_URL}/privacy`,
    },
  };
}

function renderTemplate(type: EmailType, language: Language, vars: TemplateVars) {
  const name = str(vars.name).trim();
  const enriched: TemplateVars = {
    ...vars,
    name_suffix: name ? `, ${name}` : "",
    email: str(vars.email || vars.client_email || "").trim() || (language === "fr" ? "votre compte" : "your account"),
  };
  const t = copy[type][language];
  const bodyHtml = replaceVars(t.body, enriched, "html");
  const title = replaceVars(t.title, enriched);
  const eyebrow = replaceVars(t.eyebrow, enriched);
  const preheader = replaceVars(t.preheader, enriched);
  return {
    subject: replaceVars(t.subject, enriched),
    html: emailShell({
      language,
      preheader,
      eyebrow,
      title,
      bodyHtml,
      siteUrl: SITE_URL,
      termsUrl: str(enriched.terms_url ?? `${SITE_URL}/terms`),
      privacyUrl: str(enriched.privacy_url ?? `${SITE_URL}/privacy`),
      supportEmail: REPLY_TO_EMAIL,
      supportHours: str(enriched.support_hours),
      showPolicyLinks: Boolean(t.showPolicyLinks),
      cancellationPolicyUrl: str(enriched.cancellation_policy_url ?? `${SITE_URL}/terms`),
    }),
  };
}

const copy: Record<EmailType, Record<Language, TemplateCopy>> = {
  booking_created: {
    en: {
      subject: "We received your booking request",
      preheader: "Your Premiere Services booking request is in.",
      eyebrow: "Booking",
      title: "Thanks, {{name}} — we received your request",
      showPolicyLinks: true,
      body:
        emailParagraph("We’ll email you again once your booking is confirmed.") +
        detailsBlock([
          ["Booking ID", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Time", "{{booking_time}} {{timezone}}"],
          ["Location", "{{booking_location}}"],
          ["Professional", "{{pro_name}}"],
        ]) +
        cta("Manage booking", "{{manage_booking_url}}"),
    },
    fr: {
      subject: "Nous avons reçu votre demande de réservation",
      preheader: "Votre demande de réservation Premiere Services est enregistrée.",
      eyebrow: "Réservation",
      title: "Merci, {{name}} — nous avons bien reçu votre demande",
      showPolicyLinks: true,
      body:
        emailParagraph("Nous vous écrirons de nouveau lorsque votre réservation sera confirmée.") +
        detailsBlock([
          ["ID de réservation", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Heure", "{{booking_time}} {{timezone}}"],
          ["Lieu", "{{booking_location}}"],
          ["Professionnel", "{{pro_name}}"],
        ]) +
        cta("Gérer la réservation", "{{manage_booking_url}}"),
    },
  },
  booking_confirmed: {
    en: {
      subject: "Your booking is confirmed",
      preheader: "You’re all set — booking confirmed.",
      eyebrow: "Confirmed",
      title: "You’re booked, {{name}}",
      showPolicyLinks: true,
      body:
        emailParagraph("Your Premiere Services booking is confirmed.") +
        detailsBlock([
          ["Booking ID", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Time", "{{booking_time}} {{timezone}}"],
          ["Location", "{{booking_location}}"],
          ["Professional", "{{pro_name}}"],
          ["Amount paid", "{{amount_paid}}"],
        ]) +
        cta("View booking", "{{manage_booking_url}}"),
    },
    fr: {
      subject: "Votre réservation est confirmée",
      preheader: "Tout est prêt — réservation confirmée.",
      eyebrow: "Confirmée",
      title: "C’est confirmé, {{name}}",
      showPolicyLinks: true,
      body:
        emailParagraph("Votre réservation Premiere Services est confirmée.") +
        detailsBlock([
          ["ID de réservation", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Heure", "{{booking_time}} {{timezone}}"],
          ["Lieu", "{{booking_location}}"],
          ["Professionnel", "{{pro_name}}"],
          ["Montant payé", "{{amount_paid}}"],
        ]) +
        cta("Voir la réservation", "{{manage_booking_url}}"),
    },
  },
  booking_cancelled: {
    en: {
      subject: "Your booking was cancelled",
      preheader: "Booking cancellation notice.",
      eyebrow: "Cancelled",
      title: "Your booking was cancelled",
      showPolicyLinks: true,
      body:
        emailParagraph("Hi {{name}}, this booking is no longer active.") +
        detailsBlock([
          ["Booking ID", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Original date", "{{booking_date}}"],
          ["Original time", "{{booking_time}} {{timezone}}"],
          ["Location", "{{booking_location}}"],
          ["Reason", "{{cancellation_reason}}"],
        ]) +
        cta("Manage bookings", "{{manage_booking_url}}") +
        emailSecondaryNote("Refunds or rebooking, if applicable, follow the cancellation policy."),
    },
    fr: {
      subject: "Votre réservation a été annulée",
      preheader: "Avis d’annulation de réservation.",
      eyebrow: "Annulée",
      title: "Votre réservation a été annulée",
      showPolicyLinks: true,
      body:
        emailParagraph("Bonjour {{name}}, cette réservation n’est plus active.") +
        detailsBlock([
          ["ID de réservation", "{{booking_id}}"],
          ["Service", "{{service_type}}"],
          ["Date originale", "{{booking_date}}"],
          ["Heure originale", "{{booking_time}} {{timezone}}"],
          ["Lieu", "{{booking_location}}"],
          ["Raison", "{{cancellation_reason}}"],
        ]) +
        cta("Gérer les réservations", "{{manage_booking_url}}") +
        emailSecondaryNote("Les remboursements ou nouvelles réservations, le cas échéant, suivent la politique d’annulation."),
    },
  },
  booking_reminder: {
    en: {
      subject: "Reminder: your booking is coming up",
      preheader: "Your Premiere Services booking is soon.",
      eyebrow: "Reminder",
      title: "Coming up {{reminder_window}}, {{name}}",
      showPolicyLinks: true,
      body:
        detailsBlock([
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Time", "{{booking_time}} {{timezone}}"],
          ["Location", "{{booking_location}}"],
          ["Professional", "{{pro_name}}"],
        ]) +
        cta("Manage booking", "{{manage_booking_url}}") +
        emailSecondaryNote("Need to cancel or reschedule? Please do so as early as you can."),
    },
    fr: {
      subject: "Rappel : votre réservation approche",
      preheader: "Votre réservation Premiere Services approche.",
      eyebrow: "Rappel",
      title: "Ça approche {{reminder_window}}, {{name}}",
      showPolicyLinks: true,
      body:
        detailsBlock([
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Heure", "{{booking_time}} {{timezone}}"],
          ["Lieu", "{{booking_location}}"],
          ["Professionnel", "{{pro_name}}"],
        ]) +
        cta("Gérer la réservation", "{{manage_booking_url}}") +
        emailSecondaryNote("Besoin d’annuler ou de déplacer ? Faites-le le plus tôt possible."),
    },
  },
  support_receipt: {
    en: {
      subject: "We received your message",
      preheader: "Our team has your support request.",
      eyebrow: "Support",
      title: "Thanks for writing, {{name}}",
      body:
        emailParagraph("Our support team received your message and will get back to you soon.") +
        detailsBlock([
          ["Ticket ID", "{{ticket_id}}"],
          ["Subject", "{{subject}}"],
          ["Submitted", "{{submitted_date}}"],
          ["Message", "{{message}}"],
        ]),
    },
    fr: {
      subject: "Nous avons reçu votre message",
      preheader: "Notre équipe a bien reçu votre demande.",
      eyebrow: "Soutien",
      title: "Merci de nous avoir écrits, {{name}}",
      body:
        emailParagraph("Notre équipe de soutien a bien reçu votre message et vous répondra sous peu.") +
        detailsBlock([
          ["ID du billet", "{{ticket_id}}"],
          ["Sujet", "{{subject}}"],
          ["Date d’envoi", "{{submitted_date}}"],
          ["Message", "{{message}}"],
        ]),
    },
  },
  admin_new_booking: {
    en: {
      subject: "New booking received",
      preheader: "Internal booking notification.",
      eyebrow: "Admin",
      title: "New booking received",
      body:
        detailsBlock([
          ["Booking ID", "{{booking_id}}"],
          ["Client", "{{client_name}}"],
          ["Client email", "{{client_email}}"],
          ["Client phone", "{{client_phone}}"],
          ["Professional", "{{pro_name}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Time", "{{booking_time}} {{timezone}}"],
          ["Location", "{{booking_location}}"],
          ["Status", "{{booking_status}}"],
          ["Payment status", "{{payment_status}}"],
        ]) +
        cta("Open in admin", "{{admin_booking_url}}"),
    },
    fr: {
      subject: "Nouvelle réservation reçue",
      preheader: "Notification interne.",
      eyebrow: "Admin",
      title: "Nouvelle réservation reçue",
      body:
        detailsBlock([
          ["ID de réservation", "{{booking_id}}"],
          ["Client", "{{client_name}}"],
          ["Courriel client", "{{client_email}}"],
          ["Téléphone client", "{{client_phone}}"],
          ["Professionnel", "{{pro_name}}"],
          ["Service", "{{service_type}}"],
          ["Date", "{{booking_date}}"],
          ["Heure", "{{booking_time}} {{timezone}}"],
          ["Lieu", "{{booking_location}}"],
          ["Statut", "{{booking_status}}"],
          ["Statut du paiement", "{{payment_status}}"],
        ]) +
        cta("Ouvrir dans l’admin", "{{admin_booking_url}}"),
    },
  },
  auth_confirm_signup: {
    en: {
      subject: "Confirm your Premiere Services account",
      preheader: "One step left to activate your account.",
      eyebrow: "Account",
      title: "Confirm your email",
      body:
        emailParagraph("Welcome{{name_suffix}}. Confirm your email to finish setting up Premiere Services.") +
        cta("Confirm email", "{{confirmation_url}}") +
        emailSecondaryNote("This link expires in {{expires_in}}. If you didn’t create an account, you can ignore this email."),
    },
    fr: {
      subject: "Confirmez votre compte Premiere Services",
      preheader: "Une dernière étape pour activer votre compte.",
      eyebrow: "Compte",
      title: "Confirmez votre courriel",
      body:
        emailParagraph("Bienvenue{{name_suffix}}. Confirmez votre courriel pour terminer la création de votre compte Premiere Services.") +
        cta("Confirmer mon courriel", "{{confirmation_url}}") +
        emailSecondaryNote("Ce lien expire dans {{expires_in}}. Si vous n’avez pas créé de compte, ignorez ce courriel."),
    },
  },
  auth_reset_password: {
    en: {
      subject: "Reset your Premiere Services password",
      preheader: "Reset your Premiere Services password securely.",
      eyebrow: "Security",
      title: "Reset your password",
      body:
        emailParagraph("Hi{{name_suffix}}, we received a request to reset the password for {{email}}.") +
        emailParagraph("Use the button below to choose a new password.") +
        cta("Reset password", "{{reset_url}}") +
        emailSecondaryNote("This link expires in {{expires_in}}. If you didn’t ask for a reset, you can ignore this email — your password won’t change.") +
        emailSecondaryNote("For your security, never share this link with anyone."),
    },
    fr: {
      subject: "Réinitialisez votre mot de passe Premiere Services",
      preheader: "Réinitialisez votre mot de passe Premiere Services en toute sécurité.",
      eyebrow: "Sécurité",
      title: "Réinitialisez votre mot de passe",
      body:
        emailParagraph("Bonjour{{name_suffix}}, nous avons reçu une demande de réinitialisation pour {{email}}.") +
        emailParagraph("Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe.") +
        cta("Réinitialiser le mot de passe", "{{reset_url}}") +
        emailSecondaryNote("Ce lien expire dans {{expires_in}}. Si vous n’avez pas fait cette demande, ignorez ce courriel — votre mot de passe ne changera pas.") +
        emailSecondaryNote("Pour votre sécurité, ne partagez jamais ce lien."),
    },
  },
  auth_magic_link: {
    en: {
      subject: "Your Premiere Services sign-in link",
      preheader: "Your secure Premiere Services sign-in link.",
      eyebrow: "Sign in",
      title: "Welcome back{{name_suffix}}",
      body:
        emailParagraph("Use the secure button below to access your Premiere Services account. No password needed for this step.") +
        cta("Sign in securely", "{{magic_link_url}}") +
        emailSecondaryNote("This link expires in {{expires_in}}. If you didn’t request it, you can safely ignore this email.") +
        emailSecondaryNote("For your security, don’t forward this email."),
    },
    fr: {
      subject: "Votre lien de connexion Premiere Services",
      preheader: "Votre lien de connexion sécurisé Premiere Services.",
      eyebrow: "Connexion",
      title: "Bon retour{{name_suffix}}",
      body:
        emailParagraph("Utilisez le bouton sécurisé ci-dessous pour accéder à votre compte Premiere Services. Aucun mot de passe n’est requis pour cette étape.") +
        cta("Se connecter en toute sécurité", "{{magic_link_url}}") +
        emailSecondaryNote("Ce lien expire dans {{expires_in}}. Si vous ne l’avez pas demandé, ignorez ce courriel.") +
        emailSecondaryNote("Pour votre sécurité, ne transférez pas ce courriel."),
    },
  },
};

function detailsBlock(rows: [string, string][]) {
  return emailDetails(rows);
}

function cta(label: string, url: string) {
  return emailPrimaryButton(label, url);
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

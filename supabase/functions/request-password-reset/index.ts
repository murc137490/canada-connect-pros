/**
 * Public password-reset request.
 *
 * Supabase Auth `/recover` uses Dashboard Custom SMTP, which is currently failing
 * with `535 Authentication credentials invalid`. This function generates a recovery
 * link via the Admin API and sends it through Resend (same path as other app email).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
/** Resend currently verifies premierservices.ca (altshift.ca not yet on this account). */
const DEFAULT_FROM_EMAIL = "support@premiereservices.ca";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "AltShift";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "support@altshift.ca";
const SITE_URL = trimTrailingSlash(
  Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.altshift.ca",
);

const CONSUMER_FROM_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.ca",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

/** Prefer configured FROM; never send as a consumer mailbox; fall back to verified Première domain. */
function effectiveFromEmail(configured: string): string {
  const trimmed = configured.trim();
  const at = trimmed.lastIndexOf("@");
  const domain = at >= 0 ? trimmed.slice(at + 1).toLowerCase() : "";
  if (!trimmed || (domain && CONSUMER_FROM_DOMAINS.has(domain))) return DEFAULT_FROM_EMAIL;
  // altshift.ca not verified on Resend yet — use the known-good Première sender.
  if (domain === "altshift.ca") return DEFAULT_FROM_EMAIL;
  return trimmed;
}

const recentByEmail = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

type Lang = "en" | "fr";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmail(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}

function normalizeLanguage(raw: unknown): Lang {
  return typeof raw === "string" && raw.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function allowRedirect(raw: unknown): string {
  const fallback = `${SITE_URL}/reset-password`;
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase();
    const allowed =
      host === "www.altshift.ca" ||
      host === "altshift.ca" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".vercel.app");
    if (!allowed) return fallback;
    if (!u.pathname.startsWith("/reset-password")) {
      u.pathname = "/reset-password";
      u.search = "";
      u.hash = "";
    }
    return u.toString();
  } catch {
    return fallback;
  }
}

function buildHtml(language: Lang, email: string, resetUrl: string, nameSuffix: string) {
  const fr = language === "fr";
  const title = fr ? "Réinitialisez votre mot de passe" : "Reset your password";
  const preheader = fr
    ? "Réinitialisez votre mot de passe AltShift en toute sécurité."
    : "Reset your AltShift password securely.";
  const p1 = fr
    ? `Bonjour${nameSuffix}, nous avons reçu une demande de réinitialisation pour ${email}.`
    : `Hi${nameSuffix}, we received a request to reset the password for ${email}.`;
  const p2 = fr
    ? "Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe."
    : "Use the button below to choose a new password.";
  const cta = fr ? "Réinitialiser le mot de passe" : "Reset password";
  const note = fr
    ? "Ce lien expire dans environ 1 heure. Si vous n’avez pas fait cette demande, ignorez ce courriel — votre mot de passe ne changera pas."
    : "This link expires in about 1 hour. If you didn’t ask for a reset, ignore this email — your password won’t change.";

  return `<!DOCTYPE html>
<html lang="${fr ? "fr" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AltShift</title></head>
<body style="margin:0;padding:0;background:#F8F6F3;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F6F3;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" style="width:100%;max-width:600px;background:#fff;border:1px solid #E0DAD2;border-radius:12px;">
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:26px;font-weight:700;color:#141A24;">AltShift</p>
          <div style="height:2px;width:40px;background:#102556;margin:0 0 24px;"></div>
          <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#102556;">${fr ? "Sécurité" : "Security"}</p>
          <h1 style="margin:0 0 20px;font-size:28px;line-height:1.22;color:#141A24;">${esc(title)}</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#141A24;">${esc(p1)}</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#141A24;">${esc(p2)}</p>
          <a href="${esc(resetUrl)}" style="display:inline-block;margin:8px 0 24px;padding:15px 28px;background:#102556;color:#FBF9F6;text-decoration:none;border-radius:8px;font-weight:700;">${esc(cta)}</a>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#5E6672;">${esc(note)}</p>
          <p style="margin:32px 0 0;font-size:14px;color:#5E6672;">${fr ? "Besoin d’aide ?" : "Need help?"}
            <a href="mailto:${esc(REPLY_TO_EMAIL)}" style="color:#102556;font-weight:600;">${esc(REPLY_TO_EMAIL)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(toEmail: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false as const, details: "Missing RESEND_API_KEY" };
  const fromAddr = effectiveFromEmail(FROM_EMAIL);
  const from = FROM_NAME.trim() ? `${FROM_NAME.trim()} <${fromAddr}>` : fromAddr;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [toEmail], reply_to: REPLY_TO_EMAIL, subject, html }),
  });
  const details = await response.text().catch(() => "");
  return { ok: response.ok, details };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);
  if (!RESEND_API_KEY) return json({ error: "Email delivery is not configured" }, 500);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: "Valid email required" }, 400);

    const language = normalizeLanguage(body.language);
    const redirectTo = allowRedirect(body.redirectTo ?? body.redirect_to);

    const now = Date.now();
    const last = recentByEmail.get(email) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return json({ ok: true, emailed: true });
    }
    recentByEmail.set(email, now);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("request-password-reset generateLink:", error?.message ?? "no action_link");
      return json({ ok: true, emailed: true });
    }

    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const nameSuffix = fullName ? ` ${fullName.split(/\s+/)[0]}` : "";
    const resetUrl = data.properties.action_link;
    const subject =
      language === "fr" ? "Réinitialisez votre mot de passe AltShift" : "Reset your AltShift password";
    const html = buildHtml(language, email, resetUrl, nameSuffix);

    const sent = await sendViaResend(email, subject, html);
    if (!sent.ok) {
      console.error("request-password-reset Resend failed:", sent.details);
      return json({ error: "Error sending recovery email", details: sent.details }, 502);
    }

    return json({ ok: true, emailed: true });
  } catch (error) {
    console.error("request-password-reset:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

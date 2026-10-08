/**
 * Public password-reset request.
 *
 * Supabase Auth `/recover` uses Dashboard Custom SMTP, which is currently failing
 * with `535 Authentication credentials invalid`. This function generates a recovery
 * link via the Admin API and sends it through Resend (same path as other app email).
 *
 * Accepts { identifier } (email, four-digit Member ID or username) or the legacy
 * { email }. The account email is resolved server-side and never returned; the
 * response is the same whether or not an account exists. The email also reminds
 * the member of their Member ID and username, so it doubles as "forgot my ID".
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brandAddress, brandFrom, BRAND_FROM_NAME } from "../_shared/brandSender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
/** altshift.ca is a verified Resend sending domain. */
const DEFAULT_FROM_EMAIL = "support@altshift.ca";
/** Optional env-only fallback sender if the primary sender is refused by Resend. */
const FALLBACK_FROM_EMAIL = (Deno.env.get("RESEND_FALLBACK_FROM_EMAIL") ?? "").trim().toLowerCase().endsWith("@altshift.ca")
  ? Deno.env.get("RESEND_FALLBACK_FROM_EMAIL")!.trim()
  : "";
const FROM_EMAIL = brandAddress(Deno.env.get("FROM_EMAIL"));
/**
 * Display name is always the brand. The FROM_NAME secret is ignored on purpose:
 * it still carries a legacy business name that must not reach customers.
 */
const FROM_NAME = "AltShift";
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

/** Prefer configured FROM; never send as a consumer mailbox. */
function effectiveFromEmail(configured: string): string {
  const trimmed = configured.trim();
  const at = trimmed.lastIndexOf("@");
  const domain = at >= 0 ? trimmed.slice(at + 1).toLowerCase() : "";
  if (!trimmed || (domain && CONSUMER_FROM_DOMAINS.has(domain))) return DEFAULT_FROM_EMAIL;
  return trimmed;
}

const recentByEmail = new Map<string, number>();
const recentByIp = new Map<string, number[]>();
const RATE_LIMIT_MS = 60_000;
const IP_WINDOW_MS = 15 * 60_000;
const IP_MAX_REQUESTS = 10;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Best-effort per-instance IP limiter (the per-email limiter below still applies). */
function ipAllowed(ip: string): boolean {
  const now = Date.now();
  const hits = (recentByIp.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);
  if (recentByIp.size > 5000) recentByIp.clear();
  return hits.length <= IP_MAX_REQUESTS;
}

type LoginIdentifier = { kind: "member_id" | "username"; value: string } | null;

function normalizeLoginIdentifier(raw: unknown): LoginIdentifier {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64 || trimmed.includes("@")) return null;
  const digits = trimmed.replace(/[\s#-]/g, "");
  if (/^\d+$/.test(digits)) return /^\d{4,5}$/.test(digits) ? { kind: "member_id", value: digits } : null;
  const username = trimmed.replace(/^@/, "").toLowerCase();
  return /^[a-z][a-z0-9._-]{2,29}$/.test(username) ? { kind: "username", value: username } : null;
}

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

function buildHtml(
  language: Lang,
  email: string,
  resetUrl: string,
  nameSuffix: string,
  ids: { memberId: string | null; username: string | null },
) {
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
  const idsLabel = fr ? "Vos identifiants de connexion" : "Your login details";
  const idsRows = [
    ids.memberId ? `${fr ? "Numéro de membre" : "Member ID"} : ${ids.memberId}` : "",
    ids.username ? `${fr ? "Nom d’utilisateur" : "Username"} : ${ids.username}` : "",
  ].filter(Boolean);
  const idsHint = fr
    ? "Connectez-vous avec votre numéro de membre ou votre nom d’utilisateur, et votre mot de passe."
    : "Log in with your Member ID or username, and your password.";
  const idsBlock = idsRows.length
    ? `<div style="margin:0 0 24px;padding:16px 18px;background:#F8F6F3;border:1px solid #E0DAD2;border-radius:10px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#102556;">${esc(idsLabel)}</p>
            ${idsRows.map((r) => `<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#141A24;">${esc(r)}</p>`).join("")}
            <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#5E6672;">${esc(idsHint)}</p>
          </div>`
    : "";
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
          ${idsBlock}
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

async function sendOnce(fromAddr: string, toEmail: string, subject: string, html: string) {
  const from = FROM_NAME.trim() ? `${FROM_NAME.trim()} <${fromAddr}>` : fromAddr;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [toEmail], reply_to: REPLY_TO_EMAIL, subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  const details = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, details: details.slice(0, 300) };
}

async function sendViaResend(toEmail: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false as const, status: 0, details: "Missing RESEND_API_KEY" };
  const primary = effectiveFromEmail(FROM_EMAIL);
  const first = await sendOnce(primary, toEmail, subject, html);
  if (first.ok || !FALLBACK_FROM_EMAIL || FALLBACK_FROM_EMAIL === primary) return first;
  // Sender/domain refused (e.g. key scoped to another domain): retry with the env fallback.
  if (first.status === 403 || first.status === 422) {
    console.warn("request-password-reset primary sender refused; using fallback sender");
    return await sendOnce(FALLBACK_FROM_EMAIL, toEmail, subject, html);
  }
  return first;
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
    const rawIdentifier = typeof body.identifier === "string" ? body.identifier : body.email;
    const language = normalizeLanguage(body.language);
    const redirectTo = allowRedirect(body.redirectTo ?? body.redirect_to);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let email = normalizeEmail(rawIdentifier);
    const loginId = email ? null : normalizeLoginIdentifier(rawIdentifier);
    if (!email && !loginId) return json({ error: "identifier_required" }, 400);

    // Same generic answer for every outcome below (no account enumeration).
    const generic = () => json({ ok: true, emailed: true });

    if (!ipAllowed(clientIp(req))) return generic();

    if (loginId) {
      const { data: rows, error: lookupErr } = await admin
        .from("profiles")
        .select("user_id")
        .eq(loginId.kind === "member_id" ? "public_user_number" : "username", loginId.value)
        .limit(2);
      if (lookupErr || !rows || rows.length !== 1) return generic();
      const { data: u } = await admin.auth.admin.getUserById(String(rows[0].user_id));
      email = normalizeEmail(u?.user?.email ?? "");
      if (!email) return generic();
    }

    const now = Date.now();
    const last = recentByEmail.get(email) ?? 0;
    if (now - last < RATE_LIMIT_MS) return generic();
    recentByEmail.set(email, now);

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("request-password-reset generateLink failed");
      return generic();
    }

    let memberId: string | null = null;
    let username: string | null = null;
    if (data.user?.id) {
      const { data: prof } = await admin
        .from("profiles")
        .select("public_user_number")
        .eq("user_id", data.user.id)
        .maybeSingle();
      memberId = (prof as { public_user_number?: string | null } | null)?.public_user_number ?? null;
      // Separate query so a missing username column (migration not applied) never breaks resets.
      const { data: uname } = await admin
        .from("profiles")
        .select("username")
        .eq("user_id", data.user.id)
        .maybeSingle();
      username = (uname as { username?: string | null } | null)?.username ?? null;
    }

    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const nameSuffix = fullName ? ` ${fullName.split(/\s+/)[0]}` : "";
    const resetUrl = data.properties.action_link;
    const subject =
      language === "fr" ? "Réinitialisez votre mot de passe AltShift" : "Reset your AltShift password";
    const html = buildHtml(language, email, resetUrl, nameSuffix, { memberId, username });

    const sent = await sendViaResend(email, subject, html);
    if (!sent.ok) {
      console.error("request-password-reset Resend failed", sent.status);
      // Only email-typed requests surface delivery errors (the user already knows the address).
      return loginId ? generic() : json({ error: "Error sending recovery email" }, 502);
    }

    return generic();
  } catch (error) {
    console.error("request-password-reset:", error instanceof Error ? error.name : "error");
    return json({ error: "request_failed" }, 500);
  }
});

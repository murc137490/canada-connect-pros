import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
/** Same variables as Supabase Dashboard → Project Settings → Auth → SMTP (copy into Edge secrets for this function). */
const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Deno.env.get("SMTP_PORT");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const DEFAULT_FROM_EMAIL = "no-reply@premiereservices.ca";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "Premiere Services";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "support@premiereservices.ca";
const SITE_URL = trimTrailingSlash(Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "https://premiereservices.ca");

type ReferralInvite = {
  id: string;
  invitee_email: string;
  referral_code: string;
  reward_code: string | null;
  reward_days: number;
  status: "pending" | "completed" | "reward_claimed";
  created_at: string;
  accepted_at: string | null;
  claimed_at: string | null;
};

/** Personal mailbox domains cannot be used as Resend “from”; we fall back to DEFAULT_FROM_EMAIL. */
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

function effectiveTransactionalFrom(configured: string): string {
  const trimmed = configured.trim();
  const at = trimmed.lastIndexOf("@");
  const domain = at >= 0 ? trimmed.slice(at + 1).toLowerCase() : "";
  if (domain && CONSUMER_FROM_DOMAINS.has(domain)) return DEFAULT_FROM_EMAIL;
  return trimmed || DEFAULT_FROM_EMAIL;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePromoOrTrialTokenInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromQuery = trimmed.match(/[?&]token=([^&\s#]+)/i);
  if (fromQuery?.[1]) {
    try {
      return decodeURIComponent(fromQuery[1]).trim();
    } catch {
      return fromQuery[1].trim();
    }
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    try {
      const url = new URL(trimmed, SITE_URL);
      const token = url.searchParams.get("token")?.trim();
      if (token) return token;
    } catch {
      // use trimmed
    }
  }
  return trimmed;
}

async function lookupPersonalTrialToken(admin: ReturnType<typeof createClient>, rawInput: string) {
  const rawToken = normalizePromoOrTrialTokenInput(rawInput);
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(rawToken);
  const { data: hashedToken, error: tokenErr } = await admin
    .from("trial_tokens")
    .select("id, used_at, duration_days")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenErr) throw tokenErr;
  let token = hashedToken;
  if (!token) {
    const direct = await admin
      .from("trial_tokens")
      .select("id, used_at, duration_days")
      .eq("token_value", rawToken)
      .maybeSingle();
    if (direct.error) throw direct.error;
    token = direct.data;
  }
  if (!token || token.used_at) return null;
  return {
    trial_token: rawToken,
    reward_days: Number(token.duration_days ?? 60),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "list";

    if (action === "list") {
      return json({ ok: true, invites: await listInvites(admin, user.id) });
    }

    if (action === "send") {
      const hasSmtp = Boolean(SMTP_HOST?.trim() && SMTP_USER && SMTP_PASS);
      if (!hasSmtp && !RESEND_API_KEY) {
        return json(
          {
            error:
              "Missing email configuration. Set RESEND_API_KEY (recommended for Edge), or SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.",
          },
          500
        );
      }

      const inviteeEmail = normalizeEmail(body.email);
      if (!inviteeEmail) return json({ error: "Enter a valid email address." }, 400);
      if (user.email && inviteeEmail === normalizeEmail(user.email)) {
        return json({ error: "You cannot invite yourself." }, 400);
      }

      const language = normalizeLanguage(body.language);
      const senderName = await senderDisplayName(admin, user.id, user.email ?? "");
      const referralCode = await uniqueReferralCode(admin);
      const signupUrl = `${SITE_URL}/auth?mode=signup&ref=${encodeURIComponent(referralCode)}`;

      const { data: existing } = await admin
        .from("referral_invites")
        .select("id, invitee_email, referral_code, reward_code, reward_days, status, created_at, accepted_at, claimed_at")
        .eq("inviter_user_id", user.id)
        .eq("invitee_email", inviteeEmail)
        .maybeSingle();

      const invite = existing as ReferralInvite | null;
      if (!invite) {
        const { error: insertError } = await admin.from("referral_invites").insert({
          inviter_user_id: user.id,
          invitee_email: inviteeEmail,
          referral_code: referralCode,
          reward_code: null,
        });
        if (insertError) throw insertError;
      }

      const activeCode = invite?.referral_code ?? referralCode;
      const activeSignupUrl = `${SITE_URL}/auth?mode=signup&ref=${encodeURIComponent(activeCode)}`;
      const email = renderInviteEmail(language, {
        senderName,
        signupUrl: activeSignupUrl,
      });
      const sent = await sendReferralInviteEmail(inviteeEmail, email.subject, email.html);
      if (!sent.ok) {
        return json(
          {
            error: sent.hint,
            ...(sent.details ? { details: sent.details } : {}),
          },
          502
        );
      }

      return json({ ok: true, email_sent: true, invites: await listInvites(admin, user.id) });
    }

    if (action === "claim") {
      const { data: reward, error: rewardError } = await admin
        .from("referral_invites")
        .select("id, reward_days, reward_code")
        .eq("inviter_user_id", user.id)
        .eq("status", "completed")
        .is("claimed_at", null)
        .order("accepted_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (rewardError) throw rewardError;
      if (!reward) return json({ error: "No unlocked referral coupon is available yet." }, 404);
      if (!reward.reward_code || !String(reward.reward_code).trim()) {
        return json(
          { error: "Reward token missing for this invite. Run the referral reward migration (reward_code token), then try again." },
          500
        );
      }

      const { data: profile } = await admin.from("pro_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!profile?.id) return json({ error: "Create your pro profile before claiming this Growth coupon." }, 400);

      const now = new Date();
      const nowIso = now.toISOString();
      const { data: existingSub } = await admin
        .from("pro_subscriptions")
        .select("trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const existingEnd = existingSub?.trial_ends_at ? new Date(existingSub.trial_ends_at as string) : null;
      const base = existingEnd && existingEnd > now ? existingEnd : now;
      const trialEndsAt = new Date(base.getTime() + Number(reward.reward_days ?? 14) * 24 * 60 * 60 * 1000).toISOString();

      const { error: subError } = await admin.from("pro_subscriptions").upsert(
        {
          user_id: user.id,
          plan_id: "growth",
          billing_start: nowIso,
          billing_cycle_days: 30,
          trial_ends_at: trialEndsAt,
          trial_source: "freetrial",
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
      if (subError) throw subError;

      const { error: profileError } = await admin
        .from("pro_profiles")
        .update({ subscription_tier: "growth", updated_at: nowIso })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      const { error: claimError } = await admin
        .from("referral_invites")
        .update({ status: "reward_claimed", claimed_at: nowIso, updated_at: nowIso })
        .eq("id", reward.id);
      if (claimError) throw claimError;

      const { error: panelError } = await admin
        .from("pro_profiles")
        .update({ referral_invite_panel_enabled: false, updated_at: nowIso })
        .eq("user_id", user.id);
      if (panelError) {
        console.warn("referral-invite claim: could not disable invite panel", panelError.message);
      }

      return json({
        ok: true,
        claimed: true,
        promo_code: reward.reward_code ?? "",
        trial_ends_at: trialEndsAt,
        invites: await listInvites(admin, user.id),
      });
    }

    if (action === "validate_code") {
      const rawCode = typeof body.code === "string" ? body.code.trim() : "";
      if (!rawCode) return json({ error: "Enter a promo code." }, 400);
      const reward = await lookupRewardByCode(admin, rawCode);
      if (reward) {
        return json({
          ok: true,
          valid: true,
          promo_code: reward.reward_code ?? "",
          plan_id: "growth",
          reward_days: Number(reward.reward_days ?? 14),
          code_kind: "referral",
        });
      }
      const personalTrial = await lookupPersonalTrialToken(admin, rawCode);
      if (personalTrial) {
        return json({
          ok: true,
          valid: true,
          plan_id: "growth",
          reward_days: personalTrial.reward_days,
          trial_token: personalTrial.trial_token,
          code_kind: "personal_trial",
        });
      }
      return json({ error: "Promo code is invalid or already used." }, 404);
    }

    if (action === "redeem_code") {
      const rawCode = typeof body.code === "string" ? body.code.trim() : "";
      if (!rawCode) return json({ error: "Enter a promo code." }, 400);
      const reward = await lookupRewardByCode(admin, rawCode);
      if (!reward) return json({ error: "Promo code is invalid or already used." }, 404);

      const { data: profile } = await admin.from("pro_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!profile?.id) return json({ ok: true, needs_profile: true, plan_id: "growth", reward_days: Number(reward.reward_days ?? 14) });

      const now = new Date();
      const nowIso = now.toISOString();
      const { data: existingSub } = await admin
        .from("pro_subscriptions")
        .select("trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const existingEnd = existingSub?.trial_ends_at ? new Date(existingSub.trial_ends_at as string) : null;
      const base = existingEnd && existingEnd > now ? existingEnd : now;
      const trialEndsAt = new Date(base.getTime() + Number(reward.reward_days ?? 14) * 24 * 60 * 60 * 1000).toISOString();

      const { error: subError } = await admin.from("pro_subscriptions").upsert(
        {
          user_id: user.id,
          plan_id: "growth",
          billing_start: nowIso,
          billing_cycle_days: 30,
          trial_ends_at: trialEndsAt,
          trial_source: "freetrial",
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
      if (subError) throw subError;

      const { error: profileError } = await admin
        .from("pro_profiles")
        .update({ subscription_tier: "growth", updated_at: nowIso })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      const { error: claimError } = await admin
        .from("referral_invites")
        .update({ status: "reward_claimed", claimed_at: nowIso, updated_at: nowIso })
        .eq("id", reward.id)
        .is("claimed_at", null);
      if (claimError) throw claimError;

      return json({
        ok: true,
        claimed: true,
        promo_code: reward.reward_code ?? "",
        trial_ends_at: trialEndsAt,
        plan_id: "growth",
        reward_days: Number(reward.reward_days ?? 14),
      });
    }

    return json({ error: "Invalid action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("referral_invites") || message.toLowerCase().includes("schema cache")) {
      return json({ error: "Referral database table is not installed yet. Run the referral_invites migration, then redeploy this function." }, 500);
    }
    return json({ error: message }, 500);
  }
});

async function listInvites(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("referral_invites")
    .select("id, invitee_email, referral_code, reward_code, reward_days, status, created_at, accepted_at, claimed_at")
    .eq("inviter_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

async function lookupRewardByCode(admin: ReturnType<typeof createClient>, rawCode: string) {
  const code = rawCode.trim();
  if (!code) return null;
  const { data, error } = await admin
    .from("referral_invites")
    .select("id, reward_days, reward_code, status, claimed_at")
    .eq("reward_code", code)
    .eq("status", "completed")
    .is("claimed_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function senderDisplayName(admin: ReturnType<typeof createClient>, userId: string, fallback: string) {
  const { data } = await admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  return data?.full_name || fallback || "A friend";
}

async function uniqueReferralCode(admin: ReturnType<typeof createClient>) {
  for (let i = 0; i < 5; i++) {
    const code = `REF-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const { data } = await admin.from("referral_invites").select("id").eq("referral_code", code).maybeSingle();
    if (!data) return code;
  }
  return `REF-${Date.now().toString(36).toUpperCase()}`;
}

function renderInviteEmail(language: "en" | "fr", vars: { senderName: string; signupUrl: string }) {
  const isFr = language === "fr";
  return {
    subject: isFr ? "Premiere Services - Vous avez reçu une invitation" : "Premiere Services - You've been invited",
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:14px;padding:24px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;font-weight:700;">Premiere Services</h1>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
          ${isFr ? `${escapeHtml(vars.senderName)} vous a invité.` : `${escapeHtml(vars.senderName)} invited you.`}
        </p>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
          ${isFr ? "Cliquez sur le bouton ci-dessous pour accepter l’invitation et configurer votre compte." : "Click the button below to accept the invitation and set up your account."}
        </p>
        <a href="${escapeAttr(vars.signupUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
          ${isFr ? "Accepter l’invitation" : "Accept invitation"}
        </a>
        <p style="margin:18px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
          ${isFr ? "Si vous n’êtes pas à l’origine de cette invitation, vous pouvez ignorer cet email." : "If you didn’t request this invitation, you can ignore this email."}
        </p>
        <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#6b7280;text-align:center;">
          <a href="${SITE_URL}" style="color:#1e3a5f;text-decoration:underline;">Premiere Services</a>
          ·
          <a href="${SITE_URL}/terms" style="color:#1e3a5f;text-decoration:underline;">${isFr ? "Conditions d'utilisation" : "Terms of Service"}</a>
          ·
          <a href="${SITE_URL}/privacy" style="color:#1e3a5f;text-decoration:underline;">${isFr ? "Politique de confidentialité" : "Privacy Policy"}</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#6b7280;text-align:center;">
          Premiere Services · Canada · ${isFr ? "Ceci est un courriel automatisé." : "This is an automated email."}
        </p>
      </div>
    </div>
  </body>
</html>`,
  };
}

type SendInviteResult = { ok: true } | { ok: false; hint: string; details?: string };

/**
 * Prefer Resend HTTP API when RESEND_API_KEY is set (reliable on Edge).
 * Otherwise SMTP. If SMTP is configured and fails, fall back to Resend when available.
 */
async function sendReferralInviteEmail(toEmail: string, subject: string, html: string): Promise<SendInviteResult> {
  const fromAddr = effectiveTransactionalFrom(FROM_EMAIL);
  const hasSmtp = Boolean(SMTP_HOST?.trim() && SMTP_USER && SMTP_PASS);
  const hasResend = Boolean(RESEND_API_KEY?.trim());

  if (hasResend) {
    const r = await sendViaResend(toEmail, subject, html);
    if (r.ok) return { ok: true };
    // If Resend fails (e.g. domain not verified yet) and SMTP exists, try SMTP once.
    if (hasSmtp) {
      const smtp = await sendInviteViaSmtp(toEmail, subject, html, fromAddr);
      if (smtp.ok) return { ok: true };
    }
    return {
      ok: false,
      hint:
        r.hint ??
        "Could not send email via Resend. Verify premiereservices.ca in Resend (DNS) and that RESEND_API_KEY is correct.",
      details: r.details,
    };
  }

  if (hasSmtp) {
    const smtp = await sendInviteViaSmtp(toEmail, subject, html, fromAddr);
    if (smtp.ok) return { ok: true };
    return {
      ok: false,
      hint:
        smtp.hint ??
        "Could not send via SMTP. Add RESEND_API_KEY (recommended) or fix SMTP_HOST/PORT/USER/PASS to match Auth → SMTP.",
      details: smtp.details,
    };
  }

  return {
    ok: false,
    hint: "No email transport available. Set RESEND_API_KEY (recommended) or SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.",
  };
}

async function sendInviteViaSmtp(
  toEmail: string,
  subject: string,
  html: string,
  fromEmailAddr: string,
): Promise<{ ok: true } | { ok: false; hint: string; details?: string }> {
  const host = SMTP_HOST!.trim();
  const port = parseInt(SMTP_PORT || "587", 10);
  const from = FROM_NAME.trim() ? `${FROM_NAME.trim()} <${fromEmailAddr}>` : fromEmailAddr;

  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: SMTP_USER!, password: SMTP_PASS! },
      },
      debug: { log: false, allowUnsecure: port === 587 },
    });
    await client.send({ from, to: toEmail, subject, content: " ", html });
    client.close();
    return { ok: true };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("referral-invite SMTP failed:", details);
    return {
      ok: false,
      hint:
        "SMTP send failed from the Edge Function (common with STARTTLS on port 587). Prefer RESEND_API_KEY instead of SMTP for invites.",
      details,
    };
  }
}

async function sendViaResend(toEmail: string, subject: string, html: string) {
  const fromAddr = effectiveTransactionalFrom(FROM_EMAIL);
  const from = FROM_NAME.trim() ? `${FROM_NAME.trim()} <${fromAddr}>` : fromAddr;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [toEmail], reply_to: REPLY_TO_EMAIL, subject, html }),
  });
  const details = await response.text().catch(() => "");
  const hint = parseResendErrorHint(details);
  return { ok: response.ok, details, hint };
}

/** Resend returns JSON like `{ "message": "...", "name": "validation_error" }` — surface `message` for the app UI. */
function parseResendErrorHint(body: string): string | null {
  const raw = body.trim();
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { message?: string };
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeEmail(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}

function normalizeLanguage(raw: unknown): "en" | "fr" {
  return typeof raw === "string" && raw.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

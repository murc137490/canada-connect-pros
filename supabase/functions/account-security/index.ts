/**
 * Locked account contacts and the voice PIN.
 * Email changes require a text code to the phone on file.
 * Phone changes require an email code to the login email.
 * The voice PIN can use either, chosen by the user.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toE164NorthAmerica } from "../_shared/phoneE164.ts";
import { sendTelnyxSms, telnyxSmsConfigured } from "../_shared/telnyxSms.ts";
import { brandFrom, BRAND_REPLY_TO } from "../_shared/brandSender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELNYX_API = "https://api.telnyx.com/v2";

type Purpose = "change_email" | "change_phone" | "change_pin";
type Channel = "sms" | "email";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatCanadianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function maskPhone(raw: string | null): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length < 4) return null;
  return `(***) ***-${local.slice(-4)}`;
}

function maskEmail(email: string | null): string | null {
  const value = String(email ?? "").trim();
  const at = value.indexOf("@");
  if (at < 1) return null;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function isPurpose(value: string): value is Purpose {
  return value === "change_email" || value === "change_phone" || value === "change_pin";
}

function isChannel(value: string): value is Channel {
  return value === "sms" || value === "email";
}

function sixDigitCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

async function sendSmsCode(to: string, code: string, language: "en" | "fr"): Promise<{ ok: boolean; error?: string }> {
  if (!telnyxSmsConfigured()) return { ok: false, error: "sms_not_configured" };
  const text = language === "fr"
    ? `AltShift : votre code est ${code}. Il expire dans 10 minutes.`
    : `AltShift: your code is ${code}. It expires in 10 minutes.`;
  const sent = await sendTelnyxSms({ to, text });
  if (!sent.ok) {
    console.error("account sms failed", sent.status);
    return { ok: false, error: "sms_failed" };
  }
  return { ok: true };
}

async function checkSms(to: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get("TELNYX_API_KEY")?.trim();
  const verifyProfileId = Deno.env.get("TELNYX_VERIFY_PROFILE_ID")?.trim();
  if (!apiKey || !verifyProfileId) return false;
  const res = await fetch(
    `${TELNYX_API}/verifications/by_phone_number/${encodeURIComponent(to)}/actions/verify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code, verify_profile_id: verifyProfileId }),
    },
  );
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({})) as { data?: { response_code?: string } };
  return data.data?.response_code === "accepted";
}

async function sendEmailCode(to: string, code: string, language: "en" | "fr"): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!key) return { ok: false, error: "email_not_configured" };
  // Always "AltShift <...@altshift.ca>" (altshift.ca is a verified Resend domain).
  const from = brandFrom(Deno.env.get("FROM_EMAIL"));
  const replyTo = BRAND_REPLY_TO;
  const subject = language === "fr" ? "Votre code AltShift" : "Your AltShift code";
  const line = language === "fr"
    ? "Utilisez ce code pour confirmer le changement sur votre compte AltShift. Il expire dans 10 minutes."
    : "Use this code to confirm the change on your AltShift account. It expires in 10 minutes.";
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#141A24;line-height:1.5">
    <p style="font-size:20px;font-weight:700;letter-spacing:-0.03em">AltShift</p>
    <p>${line}</p>
    <p style="font-size:28px;letter-spacing:0.2em;font-weight:700">${code}</p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("account email failed", res.status);
    return { ok: false, error: "email_failed" };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "server_misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData.user;
  if (userErr || !user?.id || !user.email) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "status");

  const { data: profile } = await admin
    .from("profiles")
    .select("phone, voice_pin_hash, email_language")
    .eq("user_id", user.id)
    .maybeSingle();
  const phone = String(profile?.phone ?? "").trim();
  const phoneE164 = toE164NorthAmerica(phone);
  const language = profile?.email_language === "fr" ? "fr" : "en";
  const hasPin = !!(profile?.voice_pin_hash && String(profile.voice_pin_hash).length > 0);

  if (action === "status") {
    return json({
      ok: true,
      has_voice_pin: hasPin,
      phone_masked: maskPhone(phone),
      email_masked: maskEmail(user.email),
      can_sms: !!phoneE164,
      can_email: !!user.email,
    });
  }

  const purposeRaw = String(body.purpose ?? "");
  const channelRaw = String(body.channel ?? "");
  if (!isPurpose(purposeRaw) || !isChannel(channelRaw)) return json({ error: "bad_request" }, 400);
  const purpose = purposeRaw;
  const channel = channelRaw;

  if (purpose === "change_email" && channel !== "sms") return json({ error: "email_requires_sms" }, 400);
  if (purpose === "change_phone" && channel !== "email") return json({ error: "phone_requires_email" }, 400);
  if (channel === "sms" && !phoneE164) return json({ error: "no_phone" }, 400);
  if (channel === "email" && !user.email) return json({ error: "no_email" }, 400);

  if (action === "send") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("account_contact_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= 8) return json({ error: "rate_limited" }, 429);

    const destination = channel === "sms" ? phoneE164! : user.email;
    const code = sixDigitCode();
    const { data: hashed, error: hashErr } = await admin.rpc("hash_voice_pin", { p_pin: code });
    if (hashErr || !hashed) return json({ error: "code_failed" }, 500);
    const codeHash = String(hashed);
    if (channel === "sms") {
      const sent = await sendSmsCode(phoneE164!, code, language);
      if (!sent.ok) return json({ error: sent.error ?? "sms_failed" }, 502);
    } else {
      const sent = await sendEmailCode(user.email, code, language);
      if (!sent.ok) return json({ error: sent.error ?? "email_failed" }, 502);
    }

    const { error: insertErr } = await admin.from("account_contact_challenges").insert({
      user_id: user.id,
      purpose,
      channel,
      destination,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertErr) return json({ error: "code_failed" }, 500);
    return json({
      ok: true,
      sent: true,
      channel,
      destination_masked: channel === "sms" ? maskPhone(phone) : maskEmail(user.email),
    });
  }

  if (action !== "apply") return json({ error: "bad_request" }, 400);

  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code" }, 400);

  const { data: challenge } = await admin
    .from("account_contact_challenges")
    .select("id, destination, code_hash, attempts, expires_at, consumed_at")
    .eq("user_id", user.id)
    .eq("purpose", purpose)
    .eq("channel", channel)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!challenge || new Date(String(challenge.expires_at)).getTime() < Date.now()) {
    return json({ error: "code_expired" }, 400);
  }
  if (Number(challenge.attempts ?? 0) >= 5) return json({ error: "too_many_attempts" }, 400);

  let passed = false;
  if (challenge.code_hash) {
    const { data: okCode } = await admin.rpc("verify_voice_pin_hash", {
      p_hash: challenge.code_hash,
      p_pin: code,
    });
    passed = okCode === true;
  } else if (channel === "sms") {
    passed = await checkSms(String(challenge.destination), code);
  }
  if (!passed) {
    await admin
      .from("account_contact_challenges")
      .update({ attempts: Number(challenge.attempts ?? 0) + 1 })
      .eq("id", challenge.id);
    return json({ error: "invalid_code" }, 400);
  }

  await admin.from("account_contact_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challenge.id);

  const grantExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  if (purpose === "change_pin") {
    const pin = String(body.new_pin ?? "").replace(/\D/g, "");
    if (!/^\d{4,6}$/.test(pin)) return json({ error: "invalid_pin" }, 400);
    const { data: pinHash, error: pinErr } = await admin.rpc("hash_voice_pin", { p_pin: pin });
    if (pinErr || !pinHash) return json({ error: "pin_failed" }, 500);
    const { error: grantErr } = await admin.from("account_contact_grants").insert({
      user_id: user.id,
      purpose: "change_pin",
      uses_left: 1,
      expires_at: grantExpiry,
    });
    if (grantErr) return json({ error: "pin_failed" }, 500);
    const { error: upErr } = await admin.from("profiles").update({ voice_pin_hash: pinHash }).eq("user_id", user.id);
    if (upErr) return json({ error: "pin_locked" }, 400);
    return json({ ok: true, has_voice_pin: true });
  }

  if (purpose === "change_phone") {
    const formatted = formatCanadianPhone(String(body.new_phone ?? ""));
    if (!formatted) return json({ error: "invalid_phone" }, 400);
    const { error: grantErr } = await admin.from("account_contact_grants").insert({
      user_id: user.id,
      purpose: "change_phone",
      new_value: formatted,
      uses_left: 2,
      expires_at: grantExpiry,
    });
    if (grantErr) return json({ error: "phone_failed" }, 500);
    const { error: upErr } = await admin.from("profiles").update({ phone: formatted }).eq("user_id", user.id);
    if (upErr) return json({ error: "phone_locked" }, 400);
    const { error: proErr } = await admin.from("pro_profiles").update({ phone: formatted }).eq("user_id", user.id);
    if (proErr) return json({ error: "phone_locked" }, 400);
    await admin
      .from("account_contact_grants")
      .update({ uses_left: 0, consumed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("purpose", "change_phone")
      .is("consumed_at", null);
    return json({ ok: true, phone: formatted, phone_masked: maskPhone(formatted) });
  }

  const nextEmail = String(body.new_email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return json({ error: "invalid_email" }, 400);
  if (nextEmail === user.email.toLowerCase()) return json({ error: "same_email" }, 400);
  const { data: taken } = await admin.rpc("auth_email_taken", { p_email: nextEmail, p_except: user.id });
  if (taken === true) return json({ error: "email_taken" }, 400);
  const { error: grantErr } = await admin.from("account_contact_grants").insert({
    user_id: user.id,
    purpose: "change_email",
    new_value: nextEmail,
    uses_left: 1,
    expires_at: grantExpiry,
  });
  if (grantErr) return json({ error: "email_failed" }, 500);
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email: nextEmail,
    email_confirm: true,
  });
  if (authErr) {
    console.error("email change blocked", authErr.message);
    return json({ error: "email_locked" }, 400);
  }
  return json({ ok: true, email: nextEmail, email_masked: maskEmail(nextEmail) });
});

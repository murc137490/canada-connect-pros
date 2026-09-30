/**
 * Telnyx Verify: send SMS OTP or check OTP (2FA / phone verification).
 * Secrets: TELNYX_API_KEY, TELNYX_VERIFY_PROFILE_ID
 *
 * POST JSON:
 * - { "action": "send", "to": "+14508003177", "channel": "sms" }
 * - { "action": "check", "to": "+14508003177", "code": "123456" }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { toE164NorthAmerica } from "../_shared/phoneE164.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELNYX_API = "https://api.telnyx.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("TELNYX_API_KEY")?.trim();
  const verifyProfileId = Deno.env.get("TELNYX_VERIFY_PROFILE_ID")?.trim();

  if (!apiKey || !verifyProfileId) {
    return new Response(
      JSON.stringify({
        error: "Telnyx Verify not configured",
        details: "Set TELNYX_API_KEY and TELNYX_VERIFY_PROFILE_ID in Edge Function secrets.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "check" ? "check" : "send";
    const rawTo = typeof body.to === "string" ? body.to.trim() : "";
    const to = toE164NorthAmerica(rawTo) ?? (rawTo.startsWith("+") ? rawTo : null);

    if (action === "send") {
      const channel = (body.channel ?? "sms").toString().toLowerCase();
      if (!to) {
        return new Response(JSON.stringify({ error: "Missing or invalid 'to' (E.164, e.g. +14508003177)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const path =
        channel === "call"
          ? `${TELNYX_API}/verifications/call`
          : `${TELNYX_API}/verifications/sms`;

      const res = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone_number: to,
          verify_profile_id: verifyProfileId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { errors?: { detail?: string }[]; message?: string };
        return new Response(
          JSON.stringify({
            error: err.errors?.[0]?.detail ?? err.message ?? "Failed to send verification",
          }),
          { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const payload = (data as { data?: { id?: string; status?: string } }).data ?? {};
      return new Response(
        JSON.stringify({ status: payload.status ?? "pending", sid: payload.id, provider: "telnyx" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // action === "check"
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!to || !code) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'code'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoded = encodeURIComponent(to);
    const res = await fetch(`${TELNYX_API}/verifications/by_phone_number/${encoded}/actions/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code,
        verify_profile_id: verifyProfileId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data as { errors?: { detail?: string }[]; message?: string };
      return new Response(
        JSON.stringify({
          error: err.errors?.[0]?.detail ?? err.message ?? "Verification check failed",
        }),
        { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const responseCode = (data as { data?: { response_code?: string } }).data?.response_code;
    const valid = responseCode === "accepted";
    return new Response(
      JSON.stringify({ status: responseCode ?? "unknown", valid, provider: "telnyx" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

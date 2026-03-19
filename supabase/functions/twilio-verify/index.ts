// Twilio Verify: send SMS OTP or check OTP. Use for 2FA, phone verification, password reset.
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TWILIO_VERIFY_BASE = "https://verify.twilio.com/v2";

function basicAuth(accountSid: string, authToken: string): string {
  return btoa(`${accountSid}:${authToken}`);
}

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

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const serviceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

  if (!accountSid || !authToken || !serviceSid) {
    return new Response(
      JSON.stringify({
        error: "Twilio Verify not configured",
        details: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID in Edge Function secrets.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const auth = basicAuth(accountSid, authToken);
  const url = `${TWILIO_VERIFY_BASE}/Services/${serviceSid}`;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "check" ? "check" : "send";

    if (action === "send") {
      const to = typeof body.to === "string" ? body.to.trim() : "";
      const channel = (body.channel ?? "sms").toString().toLowerCase();
      if (!to) {
        return new Response(
          JSON.stringify({ error: "Missing 'to' (e.g. +14505784500)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const form = new URLSearchParams();
      form.set("To", to);
      form.set("Channel", channel === "sms" || channel === "call" ? channel : "sms");

      const res = await fetch(`${url}/Verifications`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: data.message ?? "Failed to send verification",
            code: data.code,
          }),
          { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ status: data.status, sid: data.sid, valid: data.valid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action === "check"
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!to || !code) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'code'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const form = new URLSearchParams();
    form.set("To", to);
    form.set("Code", code);

    const res = await fetch(`${url}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: data.message ?? "Verification check failed",
          code: data.code,
        }),
        { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: data.status, valid: data.valid === true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Telnyx Call Control webhook (Path C support line).
 * Answers inbound calls and plays a short bilingual greeting.
 * Full AI support bot (services / booking) can be layered on later.
 *
 * Secrets optional: TELNYX_API_KEY (required to answer/speak)
 * Configure Call Control Application webhook_event_url to this function URL.
 *
 * JWT must be disabled at the gateway (see supabase/config.toml) — Telnyx posts without a Supabase JWT.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TELNYX_API = "https://api.telnyx.com/v2";

const GREETING_EN =
  "Thank you for calling AltShift. Our AI support assistant is being set up. Please visit altshift.ca for services and bookings, or email support at support@altshift.ca. Goodbye.";
const GREETING_FR =
  "Merci d'avoir appelé AltShift. Notre assistant de soutien par IA est en cours de configuration. Visitez altshift.ca pour les services et réservations, ou écrivez à support@altshift.ca. Au revoir.";

async function telnyxCommand(callControlId: string, command: string, body: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get("TELNYX_API_KEY")?.trim();
  if (!apiKey) {
    console.error("TELNYX_API_KEY missing — cannot run call command", command);
    return;
  }
  const res = await fetch(`${TELNYX_API}/calls/${callControlId}/actions/${command}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`telnyx ${command} failed`, res.status, text);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { data?: { event_type?: string; payload?: Record<string, unknown> } };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const eventType = payload?.data?.event_type ?? "";
  const call = payload?.data?.payload ?? {};
  const callControlId = String(call.call_control_id ?? "");

  console.log("telnyx voice event", eventType, callControlId || "(no id)");

  if (!callControlId) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (eventType === "call.initiated") {
    // direction may be incoming
    await telnyxCommand(callControlId, "answer", {});
  } else if (eventType === "call.answered") {
    const bilingual = `${GREETING_EN} ${GREETING_FR}`;
    await telnyxCommand(callControlId, "speak", {
      payload: bilingual,
      voice: "female",
      language: "en-US",
    });
  } else if (eventType === "call.speak.ended") {
    await telnyxCommand(callControlId, "hangup", {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

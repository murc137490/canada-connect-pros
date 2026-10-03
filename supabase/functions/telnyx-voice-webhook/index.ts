/**
 * Telnyx Call Control → AltShift Front Desk (GPT-Live path).
 * Welcome + A/B menu. Full natural-language booking uses /front-desk (WebRTC)
 * or OpenAI Realtime SIP trunk (configure separately). Tools live in front-desk-tools.
 *
 * Secrets: TELNYX_API_KEY, FRONT_DESK_SECRET (optional), OPENAI_API_KEY (optional flag)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELNYX_API = "https://api.telnyx.com/v2";

const WELCOME =
  "Welcome to Alt Shift. Pour le français, dites français. Press 1 or say A to book a new service. Press 2 or say B for an existing booking. For the full voice assistant in your browser, visit altshift.ca slash front-desk.";

async function telnyxCommand(callControlId: string, command: string, body: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get("TELNYX_API_KEY")?.trim();
  if (!apiKey) {
    console.error("TELNYX_API_KEY missing", command);
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
    console.error(`telnyx ${command} failed`, res.status, await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (eventType === "call.initiated") {
    await telnyxCommand(callControlId, "answer", {});
  } else if (eventType === "call.answered") {
    if (supabaseUrl && serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("front_desk_sessions").insert({
          channel: "phone",
          language: "en",
          call_control_id: callControlId,
          draft: {},
        });
      } catch (e) {
        console.error("front_desk session create", e);
      }
    }
    await telnyxCommand(callControlId, "speak", {
      payload: WELCOME,
      voice: "female",
      language: "en-US",
    });
  } else if (eventType === "call.speak.ended") {
    await telnyxCommand(callControlId, "gather", {
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: 12000,
      valid_digits: "12",
      inter_digit_timeout_millis: 4000,
    });
  } else if (eventType === "call.gather.ended") {
    const digits = String(call.digits ?? call.digit ?? "");
    if (digits === "1") {
      await telnyxCommand(callControlId, "speak", {
        payload:
          "New service. Please give me your four or five digit member ID using your keypad, then we will text a verification code. For natural speech booking with GPT Live, open altshift.ca slash front-desk on your phone browser.",
        voice: "female",
        language: "en-US",
      });
    } else if (digits === "2") {
      await telnyxCommand(callControlId, "speak", {
        payload:
          "Existing booking. After member ID verification, enter your booking I D — a letter followed by five digits, for example A one two three four five. Or use the Front Desk page for full voice help.",
        voice: "female",
        language: "en-US",
      });
    } else {
      await telnyxCommand(callControlId, "speak", {
        payload: "I did not get that. Goodbye.",
        voice: "female",
        language: "en-US",
      });
    }
  } else if (eventType === "call.hangup" || eventType === "call.bridged") {
    // no-op
  }

  // Hang up after second speak waves when no further gather planned
  if (eventType === "call.speak.ended" && call.client_state) {
    /* reserved */
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

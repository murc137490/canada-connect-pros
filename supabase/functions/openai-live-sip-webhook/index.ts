/**
 * OpenAI Realtime SIP webhook — accept + sideband tools (own-account only after auth).
 * Prefer realtime.call.incoming only (ignore Live dual-webhook).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FRONT_DESK_INSTRUCTIONS,
  FRONT_DESK_TOOLS,
  FRONT_DESK_VOICE,
} from "./frontDeskRealtime.ts";
import { toE164NorthAmerica } from "./phoneE164.ts";

const OPENAI_API = "https://api.openai.com/v1";
const REALTIME_MODEL = "gpt-realtime";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

type SipHeader = { name?: string; value?: string };

function extractCallerPhone(headers: SipHeader[] | undefined): string | null {
  const from = (headers ?? []).find((h) => (h.name ?? "").toLowerCase() === "from")?.value ?? "";
  const m = from.match(/(\+?\d[\d\s\-().]{8,}\d)/) || from.match(/sip:(\+?\d+)@/i);
  if (!m) return null;
  return toE164NorthAmerica(m[1]) ?? toE164NorthAmerica(m[1].replace(/\D/g, "").slice(-10));
}

/** Edge Deno WebSocket only accepts protocol strings, not a { headers } options object. */
function openRealtimeSideband(apiKey: string, callId: string): WebSocket {
  const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`;
  return new WebSocket(url, [
    "realtime",
    `openai-insecure-api-key.${apiKey}`,
    "openai-beta.realtime-v1",
  ]);
}

async function acceptRealtime(apiKey: string, callId: string, deskSessionId: string, callerPhone: string | null) {
  const instructions =
    FRONT_DESK_INSTRUCTIONS +
    `\n\nCurrent front_desk session_id (pass to EVERY tool): ${deskSessionId}` +
    `\nPhone line: +1 450 800 3177.` +
    (callerPhone ? `\nInbound caller phone (already stored): ${callerPhone}. Call identify_caller early.` : "") +
    `\nNothing has been spoken yet. You are the first voice. SPEAK IMMEDIATELY, one turn: "Bienvenue à AltShift. Préférez-vous le français? Or would you prefer English?" Then wait.`;

  const res = await fetch(`${OPENAI_API}/realtime/calls/${encodeURIComponent(callId)}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "realtime",
      model: REALTIME_MODEL,
      instructions,
      tools: FRONT_DESK_TOOLS,
      tool_choice: "auto",
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: { type: "server_vad", silence_duration_ms: 600 },
        },
        output: {
          format: { type: "audio/pcmu" },
          voice: FRONT_DESK_VOICE,
        },
      },
    }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

async function runTool(name: string, argsJson: string, deskSessionId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    args = {};
  }
  args.session_id = args.session_id || deskSessionId;
  const secret = Deno.env.get("FRONT_DESK_SECRET")?.trim() || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/front-desk-tools`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      ...(secret ? { "x-front-desk-secret": secret } : {}),
    },
    body: JSON.stringify({ action: "tool", name, arguments: args }),
  });
  return (await res.text()).slice(0, 8000);
}

async function sidebandRealtime(apiKey: string, callId: string, deskSessionId: string) {
  const ws = openRealtimeSideband(apiKey, callId);

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ws_timeout")), 10000);
    ws.onopen = () => {
      clearTimeout(t);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws_error"));
    };
  });

  const send = (obj: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  send({
    type: "response.create",
    response: {
      instructions:
        'Speak now, one continuous greeting, warm and natural. You are the first voice on the call: "Bienvenue à AltShift. Préférez-vous le français? Or would you prefer English?" Then wait briefly for the caller.',
    },
  });

  await new Promise<void>((resolve) => {
    const hardStop = setTimeout(() => {
      try {
        ws.close();
      } catch { /* ignore */ }
      resolve();
    }, 140_000);

    ws.onmessage = async (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const type = String(msg.type ?? "");
      if (type === "session.ended" || type === "response.done" && String((msg as { response?: { status?: string } }).response?.status) === "failed") {
        /* keep listening */
      }

      const handleFn = async (name: string, callIdFn: string, argsRaw: string) => {
        const output = await runTool(name, argsRaw, deskSessionId);
        send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callIdFn, output },
        });
        send({ type: "response.create" });
      };

      if (type === "response.function_call_arguments.done") {
        const name = String(msg.name ?? "");
        const callIdFn = String(msg.call_id ?? "");
        const argsRaw = String(msg.arguments ?? "{}");
        if (name && callIdFn) await handleFn(name, callIdFn, argsRaw);
      }

      if (type === "response.output_item.done") {
        const item = (msg.item ?? {}) as Record<string, unknown>;
        if (item.type === "function_call") {
          await handleFn(String(item.name ?? ""), String(item.call_id ?? ""), String(item.arguments ?? "{}"));
        }
      }
    };

    ws.onclose = () => {
      clearTimeout(hardStop);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(hardStop);
      resolve();
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "openai-live-sip-webhook" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "openai_not_configured" }), { status: 503 });
  }

  const rawBody = await req.text();
  let event: {
    id?: string;
    type?: string;
    data?: { session_id?: string; call_id?: string; sip_headers?: SipHeader[] };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const eventType = event.type ?? "";
  console.log("openai webhook", eventType, event.id ?? "");

  if (eventType === "live.transport.incoming" || eventType === "live.call.incoming") {
    return new Response(JSON.stringify({ ok: true, ignored: "live_prefer_realtime" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (eventType !== "realtime.call.incoming") {
    return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callId = String(event.data?.call_id ?? "").trim();
  if (!callId) {
    return new Response(JSON.stringify({ error: "missing_call_id" }), { status: 400 });
  }

  const callerPhone = extractCallerPhone(event.data?.sip_headers);

  let deskSessionId = crypto.randomUUID();
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: row } = await admin
      .from("front_desk_sessions")
      .insert({
        channel: "phone",
        language: "fr",
        draft: {
          openai_call_id: callId,
          openai_event_id: event.id ?? null,
          caller_phone_e164: callerPhone,
        },
      })
      .select("id")
      .maybeSingle();
    if (row?.id) deskSessionId = row.id as string;
  } catch (e) {
    console.error("session insert", e);
  }

  const accepted = await acceptRealtime(apiKey, callId, deskSessionId, callerPhone);
  console.log("realtime accept", callId, accepted.status, accepted.body.slice(0, 400));

  if (accepted.ok) {
    const sideband = sidebandRealtime(apiKey, callId, deskSessionId).catch((e) => console.error("sideband", e));
    try {
      EdgeRuntime.waitUntil(sideband);
    } catch {
      void sideband;
    }
  }

  return new Response(
    JSON.stringify({
      ok: accepted.ok,
      path: "realtime",
      call_id: callId,
      desk_session_id: deskSessionId,
      caller_phone: callerPhone,
      accept_status: accepted.status,
      detail: accepted.ok ? undefined : accepted.body.slice(0, 800),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

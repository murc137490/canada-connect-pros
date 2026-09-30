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

const OPENING_LINE =
  "Bienvenue à AltShift. Welcome to AltShift. Préférez-vous le français? Or would you prefer English?";

type RealtimeSocket = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onopen: (() => void) | null;
};

/** Client frame. Servers reject unmasked client frames. */
function maskFrame(payload: Uint8Array, opcode = 0x1): Uint8Array {
  const mask = crypto.getRandomValues(new Uint8Array(4));
  const header = [0x80 | opcode];
  if (payload.length < 126) header.push(0x80 | payload.length);
  else if (payload.length < 65536) header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  else throw new Error("frame_too_large");
  const frame = new Uint8Array(header.length + 4 + payload.length);
  frame.set(header);
  frame.set(mask, header.length);
  for (let i = 0; i < payload.length; i++) frame[header.length + 4 + i] = payload[i] ^ mask[i % 4];
  return frame;
}

function maskTextFrame(text: string, opcode = 0x1): Uint8Array {
  return maskFrame(new TextEncoder().encode(text), opcode);
}

async function writeAll(conn: Deno.Conn, bytes: Uint8Array) {
  let off = 0;
  while (off < bytes.length) {
    const n = await conn.write(bytes.subarray(off));
    if (n <= 0) throw new Error("socket_write_failed");
    off += n;
  }
}

/**
 * Deno's WebSocket constructor cannot set Authorization, and the
 * insecure-api-key subprotocol is rejected. That left the model silent
 * until the caller spoke. Handshake over TLS with the Bearer header.
 */
async function openRealtimeSideband(apiKey: string, callId: string): Promise<RealtimeSocket> {
  const path = `/v1/realtime?call_id=${encodeURIComponent(callId)}`;
  let lastDetail = "no_attempt";
  for (let attempt = 1; attempt <= 4; attempt++) {
    let conn: Deno.Conn | null = null;
    try {
      conn = await Deno.connectTls({ hostname: "api.openai.com", port: 443 });
      const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      const req =
        `GET ${path} HTTP/1.1\r\n` +
        `Host: api.openai.com\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `Authorization: Bearer ${apiKey}\r\n\r\n`;
      await writeAll(conn, new TextEncoder().encode(req));

      const buf: number[] = [];
      const tmp = new Uint8Array(2048);
      let headerEnd = -1;
      while (headerEnd < 0) {
        const n = await conn.read(tmp);
        if (n === null) throw new Error("socket_closed_during_handshake");
        for (let i = 0; i < n; i++) buf.push(tmp[i]);
        for (let i = 0; i < buf.length - 3; i++) {
          if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
            headerEnd = i;
            break;
          }
        }
        if (buf.length > 8192) break;
      }
      const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, Math.max(headerEnd, 0))));
      const statusLine = head.split("\r")[0] ?? "";
      if (headerEnd < 0 || !/^HTTP\/1\.[01] 101\b/.test(statusLine)) {
        lastDetail = head.slice(0, 180).replace(/\s+/g, " ");
        console.error("sideband handshake", attempt, lastDetail);
        try { conn.close(); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      let pending = new Uint8Array(buf.slice(headerEnd + 4));

      const socket: RealtimeSocket = {
        readyState: WebSocket.OPEN,
        onmessage: null,
        onclose: null,
        onerror: null,
        onopen: null,
        send(data: string) {
          writeAll(conn!, maskTextFrame(data)).catch((e) => {
            console.error("sideband send", e);
            socket.onerror?.();
          });
        },
        close() {
          socket.readyState = WebSocket.CLOSED;
          try { conn?.close(); } catch { /* ignore */ }
        },
      };

      const readLoop = async () => {
        let textBuf = "";
        const chunks: Uint8Array[] = pending.length ? [pending] : [];
        pending = new Uint8Array();
        const pull = async (n: number): Promise<Uint8Array | null> => {
          let have = chunks.reduce((s, c) => s + c.length, 0);
          while (have < n) {
            const block = new Uint8Array(4096);
            const got = await conn!.read(block);
            if (got === null) return null;
            chunks.push(block.subarray(0, got));
            have += got;
          }
          const merged = new Uint8Array(have);
          let o = 0;
          for (const c of chunks) {
            merged.set(c, o);
            o += c.length;
          }
          const out = merged.subarray(0, n);
          chunks.length = 0;
          if (n < merged.length) chunks.push(merged.subarray(n));
          return out;
        };
        try {
          while (socket.readyState === WebSocket.OPEN) {
            const h = await pull(2);
            if (!h) break;
            const opcode = h[0] & 0x0f;
            let len = h[1] & 0x7f;
            if (len === 126) {
              const ext = await pull(2);
              if (!ext) break;
              len = (ext[0] << 8) | ext[1];
            } else if (len === 127) {
              const ext = await pull(8);
              if (!ext) break;
              len = Number((ext[4] << 24) | (ext[5] << 16) | (ext[6] << 8) | ext[7]);
            }
            const payload = len ? await pull(len) : new Uint8Array();
            if (!payload) break;
            if (opcode === 0x9) {
              await writeAll(conn!, maskFrame(payload, 0xa));
              continue;
            }
            if (opcode === 0x8) break;
            if (opcode === 0x1 || opcode === 0x0) {
              const fin = (h[0] & 0x80) !== 0;
              const piece = new TextDecoder().decode(payload);
              if (opcode === 0x1) textBuf = piece;
              else textBuf += piece;
              if (fin) {
                socket.onmessage?.({ data: textBuf });
                textBuf = "";
              }
            }
          }
        } catch (e) {
          console.error("sideband read", e);
          socket.onerror?.();
        } finally {
          socket.readyState = WebSocket.CLOSED;
          try { conn?.close(); } catch { /* ignore */ }
          socket.onclose?.();
        }
      };
      void readLoop();
      console.log("sideband open", attempt);
      return socket;
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
      console.error("sideband connect", attempt, lastDetail);
      try { conn?.close(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw new Error(`sideband_upgrade_failed ${lastDetail}`);
}

async function acceptRealtime(apiKey: string, callId: string, deskSessionId: string, callerPhone: string | null) {
  const instructions =
    FRONT_DESK_INSTRUCTIONS +
    `\n\nCurrent front_desk session_id (pass to EVERY tool): ${deskSessionId}` +
    `\nPhone line: +1 450 800 3177.` +
    (callerPhone ? `\nInbound caller phone (already stored): ${callerPhone}. Call identify_caller early.` : "") +
    `\nNothing has been spoken yet. Do not wait for the caller. SPEAK IMMEDIATELY, one turn: "${OPENING_LINE}" Then wait.`;

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
  const ws = await openRealtimeSideband(apiKey, callId);

  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ws_timeout")), 8000);
      ws.onopen = () => {
        clearTimeout(t);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(t);
        reject(new Error("ws_error"));
      };
    });
  }

  const send = (obj: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  let spoken = false;
  let attempts = 0;
  const greet = (reason: string) => {
    if (spoken || attempts >= 2) return;
    attempts += 1;
    console.log("sideband greeting", reason);
    send({
      type: "response.create",
      response: {
        instructions:
          `Speak now. Do not wait for the caller. One continuous greeting: "${OPENING_LINE}" Then wait.`,
      },
    });
  };
  greet("open");
  const retryGreeting = setTimeout(() => greet("retry"), 1200);

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
      if (
        type === "response.created" ||
        type === "response.audio.delta" ||
        type === "response.output_audio.delta"
      ) {
        spoken = true;
        clearTimeout(retryGreeting);
      }
      if (type === "error") {
        console.log("sideband error", JSON.stringify(msg).slice(0, 400));
        spoken = false;
        greet("error");
      }
      if (type === "session.created" || type === "session.updated") {
        console.log("sideband", type);
      }
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
      clearTimeout(retryGreeting);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(hardStop);
      clearTimeout(retryGreeting);
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

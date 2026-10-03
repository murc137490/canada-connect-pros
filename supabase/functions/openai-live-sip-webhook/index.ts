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
  "Bienvenue à AltShift. Pour le français, appuyez sur 1. For English, press 2.";

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
          turn_detection: { type: "server_vad", threshold: 0.72, prefix_padding_ms: 400, silence_duration_ms: 900, interrupt_response: true },
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
      // Keep the service-key credentials identical in both gateway headers.
      apikey: serviceKey,
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
      const timer = setTimeout(() => reject(new Error("ws_timeout")), 8000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("ws_error")); };
    });
  }
  const send = (obj: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };
  let responseActive = false;
  let pendingInterruptedInput: string | null = null;
  const sendInput = (text: string) => {
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    send({ type: "response.create" });
  };
  const interruptWithInput = (text: string) => {
    if (!responseActive) { sendInput(text); return; }
    pendingInterruptedInput = text;
    // A DTMF menu answer is an intentional interruption, even though it is not speech.
    send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
  };
  const seenCalls = new Set<string>();
  let keypadCapture: { digits: string; min: number; max: number; resolve: (digits: string) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let otpTarget: { tool: string; args: Record<string, unknown> } | null = null;
  let languageMenuPending = true;
  let lastQuestion = "";
  let silenceStage = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let hangupStarted = false;
  const resetSilence = () => { if (silenceTimer) clearTimeout(silenceTimer); silenceTimer = null; lastQuestion = ""; silenceStage = 0; };
  const armSilence = () => {
    if (!lastQuestion || keypadCapture || hangupStarted) return;
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (silenceStage === 0) {
        silenceStage = 1;
        send({ type: "response.create", response: { instructions: "The caller has been silent for 7 seconds. Repeat your last question once in the same language, then wait." } });
      } else if (silenceStage === 1) {
        silenceStage = 2;
        send({ type: "response.create", response: { instructions: "The caller has been silent for another 7 seconds. Apologize that you cannot hear them, say goodbye in the current language, then end the call." } });
      } else if (silenceStage === 2) {
        hangupStarted = true;
        void fetch(`${OPENAI_API}/realtime/calls/${encodeURIComponent(callId)}/hangup`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } }).catch((e) => console.error("silence hangup", e));
      }
    }, 7000);
  };
  const collectKeypad = (min: number, max: number, prompt: string): Promise<string> => {
    send({ type: "response.create", response: { instructions: prompt } });
    return new Promise((resolve) => {
      const timer = setTimeout(() => { const digits = keypadCapture?.digits ?? ""; keypadCapture = null; resolve(digits); }, 60_000);
      keypadCapture = { digits: "", min, max, resolve: (digits) => { clearTimeout(timer); resolve(digits); }, timer };
    });
  };
  const finishCapture = (digits: string) => {
    const active = keypadCapture;
    if (!active) return;
    keypadCapture = null;
    clearTimeout(active.timer);
    active.resolve(digits);
  };
  await new Promise<void>((resolve) => {
    const hardStop = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } resolve(); }, 140_000);
    const handleFn = async (name: string, callIdFn: string, argsRaw: string) => {
      if (!name || !callIdFn || seenCalls.has(callIdFn)) return;
      seenCalls.add(callIdFn);
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(argsRaw || "{}"); } catch { args = {}; }
      let output: string;
      if (name === "verify_voice_pin") {
        const pin = await collectKeypad(4, 6, "Ask the caller to enter their 4 to 6 digit voice PIN using the telephone keypad, then press #. Never ask them to speak the PIN.");
        output = pin.length >= 4 ? await runTool(name, JSON.stringify({ ...args, pin }), deskSessionId) : JSON.stringify({ ok: false, error: "keypad_timeout" });
      } else if (name === "begin_voice_pin_setup") {
        const started = await runTool(name, argsRaw, deskSessionId);
        let ok = false;
        try { ok = JSON.parse(started).ok === true; } catch { /* keep false */ }
        if (!ok) output = started;
        else {
          let pin = "";
          let confirmed = false;
          for (let attempt = 0; attempt < 3 && !confirmed; attempt += 1) {
            pin = await collectKeypad(4, 6, "Ask the caller to choose a 4 to 6 digit PIN, enter it on the telephone keypad, and press #. Never ask for spoken digits.");
            if (!pin) break;
            const again = await collectKeypad(4, 6, "Ask the caller to enter the new PIN again on the keypad and press #.");
            confirmed = !!again && pin === again;
            if (!confirmed) send({ type: "response.create", response: { instructions: "The PIN entries did not match. Ask the caller to try once more." } });
          }
          output = confirmed ? await runTool("set_voice_pin", JSON.stringify({ session_id: deskSessionId, pin }), deskSessionId) : JSON.stringify({ ok: false, error: pin ? "pin_mismatch" : "keypad_timeout" });
        }
      } else if (name === "authenticate_member") {
        output = JSON.stringify({ ok: false, error: "sms_authentication_disabled", message: "Do not send SMS. Look up the Member ID and verify the voice PIN on the telephone keypad." });
      } else {
        output = await runTool(name, argsRaw, deskSessionId);
        if (name === "authenticate_pro" && args.action === "send_otp") {
          try { if (JSON.parse(output).ok === true) otpTarget = { tool: name, args }; } catch { /* ignore malformed tool response */ }
        }
      }
      send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callIdFn, output } });
      send({ type: "response.create" });
    };
    ws.onmessage = async (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      const type = String(msg.type ?? "");
      if (type === "response.created") responseActive = true;
      if (type === "input_audio_buffer.speech_started" || type === "transport.dtmf.received") resetSilence();
      if (type === "input_audio_buffer.speech_started" && languageMenuPending) languageMenuPending = false;
      if (type === "response.output_audio_transcript.done") {
        const transcript = String(msg.transcript ?? "").trim();
        if (transcript.endsWith("?") || transcript.endsWith("？")) lastQuestion = transcript;
      }
      if (type === "response.done" || type === "response.cancelled") {
        responseActive = false;
        if (pendingInterruptedInput) {
          const nextInput = pendingInterruptedInput;
          pendingInterruptedInput = null;
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = null;
          sendInput(nextInput);
          return;
        }
        if (silenceStage === 2) {
          hangupStarted = true;
          void fetch(`${OPENAI_API}/realtime/calls/${encodeURIComponent(callId)}/hangup`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } }).catch((e) => console.error("silence hangup", e));
        } else armSilence();
      }
      if (type === "transport.dtmf.received") {
        const key = String(msg.event ?? "");
        if (languageMenuPending && (key === "1" || key === "2")) {
          languageMenuPending = false;
          const language = key === "1" ? "fr" : "en";
          await runTool("set_session_language", JSON.stringify({ session_id: deskSessionId, language }), deskSessionId);
          interruptWithInput(language === "fr"
            ? "The caller pressed 1, which selects French. Continue in French and do not repeat the language menu. Ask whether they are calling about an account."
            : "The caller pressed 2, which selects English. Continue in English and do not repeat the language menu. Ask whether they are calling about an account.");
          return;
        }
        if (otpTarget) {
          if (key === "*" && keypadCapture) { keypadCapture.digits = ""; return; }
          if (key === "#" && keypadCapture && keypadCapture.digits.length < 6) {
            send({ type: "response.create", response: { instructions: "Ask the caller to continue entering the six-digit code on the keypad." } });
            return;
          }
          if (/^[0-9]$/.test(key)) {
            if (!keypadCapture) {
              const timer = setTimeout(() => { keypadCapture = null; otpTarget = null; }, 60_000);
              keypadCapture = { digits: "", min: 6, max: 6, resolve: () => {}, timer };
            }
            if (keypadCapture.digits.length < 6) keypadCapture.digits += key;
            if (keypadCapture.digits.length === 6) {
              const code = keypadCapture.digits;
              clearTimeout(keypadCapture.timer);
              keypadCapture = null;
              const target = otpTarget;
              otpTarget = null;
              const result = await runTool(target.tool, JSON.stringify({ ...target.args, action: "check_otp", otp_code: code }), deskSessionId);
              let verified = false;
              try { verified = JSON.parse(result).authenticated === true; } catch { /* remain false */ }
              sendInput(verified
                ? "The secure server verified the SMS code. Tell the caller verification succeeded. Do not repeat the code."
                : "The secure server rejected the SMS code. Tell the caller it did not match and offer to send a new code. Do not repeat the code.");
            }
            return;
          }
        }
        if (keypadCapture) {
          if (key === "*") keypadCapture.digits = "";
          else if (key === "#" && keypadCapture.digits.length >= keypadCapture.min) finishCapture(keypadCapture.digits);
          else if (/^[0-9]$/.test(key) && keypadCapture.digits.length < keypadCapture.max) {
            keypadCapture.digits += key;
            if (keypadCapture.digits.length === keypadCapture.max) finishCapture(keypadCapture.digits);
          } else if (key === "#") {
            send({ type: "response.create", response: { instructions: "Ask the caller to enter at least four digits, then press #." } });
          }
        } else if (/^[0-9]$/.test(key)) {
          interruptWithInput("The caller pressed keypad key " + key + " while you were speaking. Stop the current question and treat this as their live answer to the most recent numbered menu. Yes is 1 and no is 2 when that was the menu. Continue with the next step without repeating the question. Do not treat menu digits as credentials.");
        }
        return;
      }
      if (type === "error") console.log("sideband error", JSON.stringify(msg).slice(0, 400));
      if (type === "session.created" || type === "session.updated") console.log("sideband", type);
      if (type === "response.function_call_arguments.done") {
        await handleFn(String(msg.name ?? ""), String(msg.call_id ?? ""), String(msg.arguments ?? "{}"));
      } else if (type === "response.output_item.done") {
        const item = (msg.item ?? {}) as Record<string, unknown>;
        if (item.type === "function_call") await handleFn(String(item.name ?? ""), String(item.call_id ?? ""), String(item.arguments ?? "{}"));
      }
    };
    // Accepted call instructions configure the opening line, but do not start
    // audio by themselves. Create its first response exactly once.
    send({ type: "response.create" });
    ws.onclose = () => { clearTimeout(hardStop); resolve(); };
    ws.onerror = () => { clearTimeout(hardStop); resolve(); };
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

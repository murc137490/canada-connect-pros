/**
 * OpenAI Realtime SIP webhook for the AltShift phone line (+1 450 800 3177).
 *
 * Telnyx (TeXML, telnyx-texml-openai) dials sip:<project>@sip.api.openai.com.
 * OpenAI posts `realtime.call.incoming` here; we accept the call with the
 * Front Desk config, then keep a "sideband" WebSocket on the call to:
 *   - greet immediately, run tools (front-desk-tools) with fillers + timeouts,
 *   - capture keypad digits (language, voice PIN) privately,
 *   - handle silence (one check-in, then a polite goodbye + hang-up),
 *   - hand off to a person or file a callback, end calls cleanly,
 *   - relay the sideband to a fresh worker before the Edge wall-clock limit.
 *
 * Env (all optional except the first two):
 *   OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_URL)
 *   OPENAI_WEBHOOK_SECRET            whsec_… from the OpenAI webhook settings
 *   OPENAI_WEBHOOK_SIGNATURE_MODE    "log" (default) | "enforce" | "off"
 *   FRONT_DESK_HUMAN_TRANSFER_URI    live-transfer target (SIP Refer-To): tel:+1… or sip:…@…
 *                                    (default tel:+14505784500, the team's cell; a number is not a secret)
 *   FRONT_DESK_SIDEBAND_MAX_MS       per-worker budget before relaying (default 140000)
 *   FRONT_DESK_SILENCE_MS            silence before a check-in (default 9000)
 *   FRONT_DESK_TOOL_TIMEOUT_MS       per tool call (default 9000)
 *   + the audio/model overrides documented in frontDeskRealtime.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type DeskLang,
  FILLERS,
  FRONT_DESK_INSTRUCTIONS,
  FRONT_DESK_MODEL,
  FRONT_DESK_TOOLS,
  legacyPhoneAudioConfig,
  PHONE_OPENING_LINE,
  phoneAudioConfig,
  STILL_WORKING,
} from "./frontDeskRealtime.ts";
import { toE164NorthAmerica } from "./phoneE164.ts";
import { openRealtimeSideband, type RealtimeSocket } from "./sidebandSocket.ts";

const OPENAI_API = "https://api.openai.com/v1";
const RELAY_EVENT = "altshift.sideband.relay";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

function envNum(key: string, fallback: number, min: number, max: number): number {
  const raw = Number(Deno.env.get(key));
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback;
}

const TOOL_TIMEOUT_MS = envNum("FRONT_DESK_TOOL_TIMEOUT_MS", 9000, 3000, 20000);
const SILENCE_MS = envNum("FRONT_DESK_SILENCE_MS", 9000, 5000, 30000);
const SIDEBAND_BUDGET_MS = envNum("FRONT_DESK_SIDEBAND_MAX_MS", 140_000, 60_000, 390_000);
const RELAY_SOFT_MS = SIDEBAND_BUDGET_MS - 25_000;
const RELAY_HARD_MS = SIDEBAND_BUDGET_MS - 5_000;
const MAX_HOPS = 30;
const FILLER_DELAY_MS = 1800;
const STILL_WORKING_MS = 6500;
const KEYPAD_TIMEOUT_MS = 30_000;
const KEYPAD_REMINDER_MS = 12_000;
/** Tools that are instant or must not get a filler. */
const NO_FILLER = new Set([
  "set_session_language",
  "clear_caller_guess",
  "end_call",
  "close_session",
  "transfer_to_human",
  "verify_voice_pin",
  "begin_voice_pin_setup",
  "authenticate_member",
  "authenticate_pro",
]);
/** The keypad language choice (1/2) only counts at the very start of the call. */
const LANGUAGE_MENU_MS = 20_000;

/* ---------- live transfer to a person (phone only) ---------- */
/** Default live-transfer target. FRONT_DESK_HUMAN_TRANSFER_URI overrides it. */
const DEFAULT_TRANSFER_URI = "tel:+14505784500";
const TRANSFER_URI_RE = /^(tel:\+[1-9]\d{7,14}|sips?:[^\s<>"@]+@[^\s<>"]+)$/i;
/**
 * OpenAI's REFER endpoint takes a `target_uri` placed in the SIP Refer-To header
 * (`tel:+E164` or `sip:user@host`). A bare "+1…" env value is accepted as tel:.
 */
export function transferTarget(raw = Deno.env.get("FRONT_DESK_HUMAN_TRANSFER_URI")): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_TRANSFER_URI;
  const candidate = /^\+[1-9]\d{7,14}$/.test(value) ? `tel:${value}` : value;
  if (TRANSFER_URI_RE.test(candidate)) return candidate;
  console.error("FRONT_DESK_HUMAN_TRANSFER_URI has an unsupported format; using the default");
  return DEFAULT_TRANSFER_URI;
}
/** After OpenAI accepts the REFER, the AI leg must drop within this window or we treat the transfer as failed. */
const TRANSFER_CONFIRM_MS = 8000;
/** Spoken before the REFER when the model did not already announce the transfer. Never includes a number. */
const TRANSFER_LINE: Record<DeskLang, string> = {
  fr: "Je vous transfère à un membre de notre équipe, un instant.",
  en: "I'm transferring you to a member of our team, one moment.",
};
const TRANSFER_TRIGGERS = new Set(["repeated_request", "insistent_or_upset", "unresolved_after_two_attempts"]);

/** Phone version of transfer_to_human: same name and flow, plus the trigger that justifies it. */
const PHONE_TRANSFER_TOOL = {
  type: "function",
  name: "transfer_to_human",
  description:
    "Phone only. Transfer this live call to a member of the AltShift team. Use ONLY under the live-transfer rule in your instructions " +
    "(a second clear request for a person after you offered help or a callback; strong insistence or a clearly upset caller; or two unsuccessful attempts). " +
    "Never for emergencies (give the 9-1-1 instruction instead). Say the one-line transfer notice first, then call this and stay silent. " +
    "If the result says the transfer did not go through, apologize and say a member of the team will call back shortly.",
  parameters: {
    type: "object",
    properties: {
      session_id: { type: "string" },
      reason: { type: "string", description: "Short neutral summary of what the caller needs. Never include a PIN, card, or phone number." },
      trigger: {
        type: "string",
        enum: ["repeated_request", "insistent_or_upset", "unresolved_after_two_attempts"],
        description: "Which part of the transfer rule applies.",
      },
    },
    required: ["session_id", "reason", "trigger"],
  },
} as const;
const PHONE_TOOLS = FRONT_DESK_TOOLS.map((t) => (t.name === "transfer_to_human" ? PHONE_TRANSFER_TOOL : t));

const TRANSFER_RULES = `

# Live transfer to a person (phone only)
A live transfer to a member of the AltShift team is available on this call. It replaces the general hand-off guidance above for transfers.
Call transfer_to_human when ANY of these is true:
1. The caller clearly asks for a person (human, agent, someone, « quelqu'un », « un humain », « un agent ») a SECOND time, after you already offered to help or offered a callback. The first time they ask, briefly offer to help yourself or offer a callback (request_callback); if they ask again, or decline the callback and still want a person, transfer (trigger repeated_request).
2. They insist strongly the first time (for example "I want a human now", "stop, put me through to someone") or are clearly upset, angry or distressed: transfer right away (trigger insistent_or_upset).
3. You have tried twice and still cannot solve their need (two unsuccessful attempts, or two failed tool results) and they still need help: transfer (trigger unresolved_after_two_attempts).
Never transfer for an emergency: give the 9-1-1 instruction instead. Do not transfer for a single casual mention, for off-topic requests, or when the caller is satisfied with a callback.
No identity verification is needed to transfer.
Before calling transfer_to_human, say exactly one short sentence in the caller's language, and nothing else:
- FR: « Je vous transfère à un membre de notre équipe, un instant. »
- EN: "I'm transferring you to a member of our team, one moment."
Then call transfer_to_human (session_id, a short neutral reason, trigger) and stay silent. Never say, spell, or confirm any phone number for the transfer, even if asked.
If the result says the transfer did not go through: apologize briefly, say a member of the AltShift team will call back shortly, and ask if there is anything else. Do not try to transfer again.`;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/* ------------------------------------------------------------------ helpers */

type SipHeader = { name?: string; value?: string };

function extractCallerPhone(headers: SipHeader[] | undefined): string | null {
  const from = (headers ?? []).find((h) => (h.name ?? "").toLowerCase() === "from")?.value ?? "";
  const m = from.match(/(\+?\d[\d\s\-().]{8,}\d)/) || from.match(/sip:(\+?\d+)@/i);
  if (!m) return null;
  return toE164NorthAmerica(m[1]) ?? toE164NorthAmerica(m[1].replace(/\D/g, "").slice(-10));
}

function errName(e: unknown): string {
  return e instanceof Error ? `${e.name}:${e.message.slice(0, 80)}` : "error";
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function openaiPost(path: string, apiKey: string, body: unknown, timeoutMs = 8000): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(`${OPENAI_API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok, status: res.status, text: (await res.text().catch(() => "")).slice(0, 400) };
  } catch (e) {
    return { ok: false, status: 0, text: errName(e) };
  }
}

/**
 * Standard Webhooks signature (what OpenAI uses): base64(HMAC-SHA256(secret, `${id}.${ts}.${body}`)).
 * Returns "ok" | "unconfigured" | a failure reason.
 */
async function verifyOpenAIWebhook(req: Request, rawBody: string): Promise<string> {
  const secret = Deno.env.get("OPENAI_WEBHOOK_SECRET")?.trim();
  if (!secret) return "unconfigured";
  const id = req.headers.get("webhook-id") ?? "";
  const ts = req.headers.get("webhook-timestamp") ?? "";
  const sigHeader = req.headers.get("webhook-signature") ?? "";
  if (!id || !ts || !sigHeader) return "missing_headers";
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return "stale_timestamp";
  let keyBytes: Uint8Array;
  try {
    keyBytes = secret.startsWith("whsec_")
      ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(secret);
  } catch {
    return "bad_secret_format";
  }
  const keyBuf = new ArrayBuffer(keyBytes.byteLength);
  new Uint8Array(keyBuf).set(keyBytes);
  const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`)));
  const expected = btoa(String.fromCharCode(...mac));
  const ok = sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return !!sig && timingSafeEqual(sig, expected);
  });
  return ok ? "ok" : "bad_signature";
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/* ------------------------------------------------------------------ accept */

function callInstructions(deskSessionId: string, hasCallerPhone: boolean): string {
  return FRONT_DESK_INSTRUCTIONS +
    `\n\n# This call\n- Channel: phone. Current front_desk session_id (pass to EVERY tool): ${deskSessionId}` +
    (hasCallerPhone
      ? "\n- The caller's number is known to the system (never read it aloud). Call identify_caller early, once you know why they are calling about an account."
      : "\n- The caller's number is hidden: ask for the four-digit Member ID when account access is needed.") +
    `\n- The call starts with your greeting: "${PHONE_OPENING_LINE}"` +
    TRANSFER_RULES;
}

async function acceptCall(apiKey: string, callId: string, deskSessionId: string, hasCallerPhone: boolean) {
  const base = {
    type: "realtime",
    model: FRONT_DESK_MODEL,
    instructions: callInstructions(deskSessionId, hasCallerPhone),
    tools: PHONE_TOOLS,
    tool_choice: "auto",
  };
  const path = `/realtime/calls/${encodeURIComponent(callId)}/accept`;
  let res = await openaiPost(path, apiKey, { ...base, audio: phoneAudioConfig() });
  if (!res.ok && res.status === 0) {
    // Network blip: one quick retry.
    await new Promise((r) => setTimeout(r, 300));
    res = await openaiPost(path, apiKey, { ...base, audio: phoneAudioConfig() });
  }
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    // A tuning field was rejected: fall back to the exact config that ran in production.
    console.error("accept rejected tuned config, retrying legacy", res.status, res.text.slice(0, 200));
    res = await openaiPost(path, apiKey, { ...base, model: "gpt-realtime", audio: legacyPhoneAudioConfig() });
  }
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400));
    res = await openaiPost(path, apiKey, { ...base, audio: legacyPhoneAudioConfig() });
  }
  return res;
}

/* ------------------------------------------------------------------ tools */

async function runTool(name: string, args: Record<string, unknown>, deskSessionId: string, timeoutMs = TOOL_TIMEOUT_MS): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const secret = Deno.env.get("FRONT_DESK_SECRET")?.trim() || "";
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/front-desk-tools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        ...(secret ? { "x-front-desk-secret": secret } : {}),
      },
      body: JSON.stringify({ action: "tool", name, arguments: { ...args, session_id: deskSessionId } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("front-desk-tools http", name, res.status);
      return JSON.stringify({ ok: false, error: "tool_unavailable" });
    }
    return text.slice(0, 8000);
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error("front-desk-tools failed", name, timedOut ? "timeout" : errName(e));
    return JSON.stringify({ ok: false, error: timedOut ? "tool_timeout" : "tool_unavailable" });
  }
}

/** front-desk-tools wraps results as {ok, result}. */
function toolFailed(output: string): boolean {
  try {
    const parsed = JSON.parse(output) as { ok?: boolean; error?: string; result?: { ok?: boolean; error?: string } };
    const r = parsed.result ?? parsed;
    return parsed.ok === false || r.ok === false || !!r.error;
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------------ call controller */

type RelayState = { lang: DeskLang; failures: number; hop: number; transferTried?: boolean };

type ResponseReq = Record<string, unknown> | undefined;

const T = {
  checkIn: {
    fr: "Le client ne répond pas. Une seule fois, vérifiez doucement s'il est toujours là (par exemple « Êtes-vous toujours là? »), puis reformulez votre dernière question plus simplement, en français. Ne répétez pas mot pour mot.",
    en: "The caller is not answering. Once, gently check that they are still there (for example \"Are you still there?\"), then rephrase your last question more simply, in English. Do not repeat it word for word.",
  },
  pinPrompt: {
    fr: "En français, demandez au client d'entrer son NIP vocal de 4 à 6 chiffres sur le clavier du téléphone, puis le carré. Ne demandez jamais de le dire à voix haute. Une phrase.",
    en: "In English, ask the caller to enter their 4 to 6 digit voice PIN on the phone keypad, then press pound. Never ask them to say it out loud. One sentence.",
  },
  pinReminder: {
    fr: "En français, une phrase : rappelez doucement d'entrer le NIP sur le clavier, puis le carré.",
    en: "In English, one sentence: gently remind the caller to enter the PIN on the keypad, then press pound.",
  },
  newPin: {
    fr: "En français, demandez au client de choisir un NIP de 4 à 6 chiffres, de l'entrer sur le clavier, puis le carré.",
    en: "In English, ask the caller to choose a 4 to 6 digit PIN, enter it on the keypad, then press pound.",
  },
  newPinAgain: {
    fr: "En français, demandez d'entrer le nouveau NIP une deuxième fois sur le clavier, puis le carré.",
    en: "In English, ask the caller to enter the new PIN a second time on the keypad, then press pound.",
  },
  pinMismatch: {
    fr: "En français : les deux NIP ne correspondent pas. Demandez d'essayer encore une fois.",
    en: "In English: the two PINs did not match. Ask the caller to try once more.",
  },
  pinShort: {
    fr: "En français : demandez d'entrer au moins quatre chiffres, puis le carré.",
    en: "In English: ask the caller to enter at least four digits, then press pound.",
  },
  wrapUp: {
    fr: "Vos outils ne sont plus disponibles pour cet appel. Si le client a encore besoin de quelque chose, dites qu'un membre de l'équipe AltShift peut le rappeler s'il rappelle ou écrit au soutien sur le site, puis concluez poliment.",
    en: "Your tools are no longer available for this call. If the caller still needs something, say they can call back or contact AltShift support from the website, then close politely.",
  },
};

function say(text: string): Record<string, unknown> {
  return {
    conversation: "none",
    output_modalities: ["audio"],
    tool_choice: "none",
    instructions: `Say exactly this short sentence, calmly, and nothing else: "${text}"`,
  };
}

async function runCall(opts: {
  apiKey: string;
  callId: string;
  deskSessionId: string;
  startedAt: number;
  state: RelayState;
  socket: RealtimeSocket;
  greet: boolean;
}): Promise<void> {
  const { apiKey, callId, deskSessionId, startedAt } = opts;
  let ws = opts.socket;
  let lang: DeskLang = opts.state.lang;
  let consecutiveFailures = opts.state.failures;
  /** One live-transfer attempt per call; later requests file a callback instead. */
  let transferTried = opts.state.transferTried === true;
  const hop = opts.state.hop;
  const tag = `call ${callId.slice(-8)} hop ${hop}`;

  // Response bookkeeping: never two in-band responses at once (no talking over).
  let createPending = false;
  let createPendingTimer: ReturnType<typeof setTimeout> | null = null;
  const active = new Set<string>();
  const queue: ResponseReq[] = [];
  let lastCreate: ResponseReq;
  const busy = () => createPending || active.size > 0;

  // Audio + turn state
  let audioPlaying = false;
  let sawAudioBufferEvents = false;
  let callerSpeaking = false;
  let toolsInFlight = 0;
  let lastFillerIdx = -1;
  let languageMenuPending = hop === 0;
  let pendingInterruptedInput: string | null = null;

  // Silence
  let silenceStage = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  // Ending / relay
  let ending = false;
  let hungUp = false;
  let handedOff = false;
  let relaying = false;
  let finished = false;
  let hangupTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnects = 0;
  // Live transfer: while a REFER is pending, a socket close means the call left the AI line.
  let transferring = false;
  let transferSocketClosed = false;
  let onTransferSocketClose: (() => void) | null = null;

  type Capture = {
    digits: string;
    min: number;
    max: number;
    resolve: (digits: string) => void;
    timer: ReturnType<typeof setTimeout>;
    reminder?: ReturnType<typeof setTimeout>;
    submitTimer?: ReturnType<typeof setTimeout>;
  };
  let keypadCapture: Capture | null = null;
  const seenCalls = new Set<string>();

  const send = (obj: Record<string, unknown>) => {
    if (ws.open) ws.send(JSON.stringify(obj));
  };

  const createResponse = (resp?: ResponseReq) => {
    if (hungUp || handedOff) return;
    if (busy()) {
      queue.push(resp);
      return;
    }
    createPending = true;
    lastCreate = resp;
    if (createPendingTimer) clearTimeout(createPendingTimer);
    createPendingTimer = setTimeout(() => {
      createPending = false;
      flushQueue();
    }, 5000);
    send({ type: "response.create", ...(resp ? { response: resp } : {}) });
  };
  const flushQueue = () => {
    if (!busy() && queue.length && !hungUp) createResponse(queue.shift());
  };
  const sendInput = (text: string) => {
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    createResponse();
  };
  const cancelSpeech = () => {
    send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
  };
  const interruptWithInput = (text: string) => {
    if (!busy() && !audioPlaying) {
      sendInput(text);
      return;
    }
    pendingInterruptedInput = text;
    cancelSpeech();
    if (!busy()) {
      const next = pendingInterruptedInput;
      pendingInterruptedInput = null;
      sendInput(next);
    }
  };

  /* ---------- silence ---------- */
  const clearSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };
  const armSilence = (extraMs = 0) => {
    clearSilence();
    if (ending || hungUp || handedOff || keypadCapture || toolsInFlight > 0 || callerSpeaking || busy()) return;
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (ending || keypadCapture || toolsInFlight > 0 || callerSpeaking || busy() || audioPlaying) return;
      if (silenceStage === 0) {
        silenceStage = 1;
        createResponse({ instructions: T.checkIn[lang] });
      } else {
        silenceStage = 2;
        ending = true;
        createResponse(say(lang === "fr"
          ? "Je ne vous entends plus. N'hésitez pas à rappeler AltShift. Au revoir."
          : "I can't hear you anymore. Please feel free to call AltShift back. Goodbye."));
      }
    }, SILENCE_MS + extraMs);
  };

  /* ---------- hang-up ---------- */
  const markClosed = async () => {
    try {
      await admin().from("front_desk_sessions").update({ closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", deskSessionId).is("closed_at", null);
    } catch (e) {
      console.error(tag, "mark closed failed", errName(e));
    }
  };
  const hangUpNow = async (reason: string) => {
    if (hungUp) return;
    hungUp = true;
    clearSilence();
    if (hangupTimer) clearTimeout(hangupTimer);
    console.log(tag, "hangup", reason);
    const res = await openaiPost(`/realtime/calls/${encodeURIComponent(callId)}/hangup`, apiKey, {}, 5000);
    if (!res.ok && res.status !== 404) console.error(tag, "hangup failed", res.status);
    await markClosed();
    finish();
  };
  /** Hang up once the goodbye has finished playing (or after an estimate if no audio events). */
  const hangUpAfterAudio = (estimateMs: number) => {
    ending = true;
    clearSilence();
    if (hangupTimer) clearTimeout(hangupTimer);
    hangupTimer = setTimeout(() => void hangUpNow("after_goodbye_timer"), Math.min(Math.max(estimateMs, 1500), 12_000));
  };

  /* ---------- keypad ---------- */
  const collectKeypad = (min: number, max: number, prompt: string, reminder: string): Promise<string> => {
    clearSilence();
    createResponse({ conversation: "none", tool_choice: "none", output_modalities: ["audio"], instructions: prompt });
    return new Promise((resolve) => {
      const done = (digits: string) => {
        const c = keypadCapture;
        keypadCapture = null;
        if (c) {
          clearTimeout(c.timer);
          if (c.reminder) clearTimeout(c.reminder);
          if (c.submitTimer) clearTimeout(c.submitTimer);
        }
        resolve(digits);
      };
      const timer = setTimeout(() => done(keypadCapture?.digits ?? ""), KEYPAD_TIMEOUT_MS);
      const reminderTimer = setTimeout(() => {
        if (keypadCapture && !keypadCapture.digits && !busy()) {
          createResponse({ conversation: "none", tool_choice: "none", output_modalities: ["audio"], instructions: reminder });
        }
      }, KEYPAD_REMINDER_MS);
      keypadCapture = { digits: "", min, max, resolve: done, timer, reminder: reminderTimer };
    });
  };
  const finishCapture = (digits: string) => keypadCapture?.resolve(digits);

  /* ---------- fillers ---------- */
  const nextFiller = () => {
    const list = FILLERS[lang];
    let idx = Math.floor(Math.random() * list.length);
    if (idx === lastFillerIdx) idx = (idx + 1) % list.length;
    lastFillerIdx = idx;
    return list[idx];
  };
  const startFillers = (modelAlreadySpoke: boolean, needsFiller: boolean) => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!needsFiller) return () => {};
    const canSpeak = () => toolsInFlight > 0 && !busy() && !audioPlaying && !callerSpeaking && !keypadCapture && !hungUp;
    if (!modelAlreadySpoke) {
      timers.push(setTimeout(() => {
        if (canSpeak()) createResponse(say(nextFiller()));
      }, FILLER_DELAY_MS));
    }
    timers.push(setTimeout(() => {
      if (canSpeak()) createResponse(say(STILL_WORKING[lang]));
    }, STILL_WORKING_MS));
    return () => timers.forEach(clearTimeout);
  };

  /* ---------- function calls ---------- */
  const waitForAudioIdle = async (maxMs: number) => {
    const until = Date.now() + maxMs;
    while ((audioPlaying || busy()) && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
  };
  /** Let the transfer notice finish playing before the REFER cuts the AI leg. */
  const waitForSpeechToFinish = async (chars: number) => {
    await waitForAudioIdle(8000);
    // Without playback events, estimate the remaining audio (~13 chars/s).
    if (!sawAudioBufferEvents) await new Promise((r) => setTimeout(r, Math.min(Math.max(chars * 70, 1200), 6000)));
  };

  /**
   * POST /v1/realtime/calls/{id}/refer. OpenAI answers 200 once the REFER is relayed to Telnyx;
   * Telnyx then drops the AI leg and runs the TeXML referUrl (dial the team). So success = the
   * sideband closes shortly after. If it stays open, the transfer did not happen.
   * Returns "transferred" | "call_ended" | a failure code. Logs carry no PII.
   */
  const attemptLiveTransfer = async (): Promise<string> => {
    const target = transferTarget();
    transferring = true;
    let resolveLeft: (left: boolean) => void = () => {};
    const left = new Promise<boolean>((r) => (resolveLeft = r));
    onTransferSocketClose = () => resolveLeft(true);
    const started = Date.now();
    // The caller may have hung up while the notice played: nothing to transfer.
    const res = transferSocketClosed
      ? { ok: false, status: 0, text: "" }
      : await openaiPost(`/realtime/calls/${encodeURIComponent(callId)}/refer`, apiKey, { target_uri: target }, 6000);
    let outcome: string;
    if (!res.ok) {
      outcome = transferSocketClosed ? "call_ended" : `refer_failed_${res.status || "network"}`;
    } else {
      console.log(tag, "transfer refer accepted", target.startsWith("tel:") ? "tel" : "sip");
      const timer = setTimeout(() => resolveLeft(false), TRANSFER_CONFIRM_MS);
      outcome = (await left) ? "transferred" : "no_handoff";
      clearTimeout(timer);
    }
    transferring = false;
    onTransferSocketClose = null;
    console.log(tag, "transfer outcome", outcome, `${Date.now() - started}ms`);
    if (outcome === "transferred" || outcome === "call_ended") {
      handedOff = true; // the call left OpenAI; stop driving it
      await markClosed();
      finish();
    }
    return outcome;
  };

  const handleFn = async (
    name: string,
    args: Record<string, unknown>,
    ctx: { modelSpoke: boolean; spokenChars: number },
  ): Promise<string | null> => {
    switch (name) {
      case "verify_voice_pin": {
        const pin = await collectKeypad(4, 6, T.pinPrompt[lang], T.pinReminder[lang]);
        if (pin.length < 4) return JSON.stringify({ ok: false, error: "keypad_timeout", message: "No PIN was entered. Offer to try once more or request_callback." });
        return await runTool(name, { ...args, pin }, deskSessionId);
      }
      case "begin_voice_pin_setup": {
        const started = await runTool(name, args, deskSessionId);
        if (toolFailed(started)) return started;
        let pin = "";
        let confirmed = false;
        for (let attempt = 0; attempt < 2 && !confirmed; attempt += 1) {
          pin = await collectKeypad(4, 6, T.newPin[lang], T.pinReminder[lang]);
          if (pin.length < 4) break;
          const again = await collectKeypad(4, 6, T.newPinAgain[lang], T.pinReminder[lang]);
          confirmed = again === pin;
          if (!confirmed && attempt === 0) createResponse({ conversation: "none", tool_choice: "none", output_modalities: ["audio"], instructions: T.pinMismatch[lang] });
        }
        return confirmed
          ? await runTool("set_voice_pin", { pin }, deskSessionId)
          : JSON.stringify({ ok: false, error: pin.length >= 4 ? "pin_mismatch" : "keypad_timeout" });
      }
      case "authenticate_member":
      case "authenticate_pro":
        return JSON.stringify({ ok: false, error: "sms_authentication_disabled", message: "Never send SMS on the phone. Use the four-digit Member ID and the keypad voice PIN." });
      case "set_session_language": {
        const requested = String(args.language ?? "").toLowerCase();
        if (requested === "en" || requested === "fr") lang = requested;
        languageMenuPending = false;
        return await runTool(name, args, deskSessionId, 4000);
      }
      case "transfer_to_human": {
        const trigger = TRANSFER_TRIGGERS.has(String(args.trigger)) ? String(args.trigger) : "unspecified";
        const reason = String(args.reason ?? "").slice(0, 400);
        if (transferTried) {
          console.log(tag, "transfer skipped", "already_tried");
          return await runTool("transfer_to_human", { reason }, deskSessionId);
        }
        transferTried = true;
        console.log(tag, "transfer requested", trigger);
        // From here until the REFER settles: no relay, and a socket close is handled by the transfer.
        transferring = true;
        transferSocketClosed = false;
        let ticket: string;
        let outcome: string;
        try {
          // File the callback ticket first: it is the fallback if the transfer or the team's line fails.
          const ticketP = runTool("transfer_to_human", { reason: `${reason} (live transfer attempted; trigger: ${trigger})` }, deskSessionId, 5000);
          if (!ctx.modelSpoke) createResponse(say(TRANSFER_LINE[lang]));
          await waitForSpeechToFinish(ctx.modelSpoke ? ctx.spokenChars : TRANSFER_LINE[lang].length);
          ticket = await ticketP;
          outcome = hungUp || handedOff ? "call_ended" : await attemptLiveTransfer();
        } finally {
          transferring = false;
          onTransferSocketClose = null;
        }
        if (outcome === "transferred" || outcome === "call_ended") {
          if (!handedOff && !hungUp) {
            handedOff = true;
            await markClosed();
            finish();
          }
          return null;
        }
        const callbackFiled = !toolFailed(ticket);
        console.log(tag, "transfer fallback", callbackFiled ? "callback_ticket" : "no_ticket");
        return JSON.stringify({
          ok: false,
          error: "transfer_unavailable",
          live_transfer: false,
          callback_requested: callbackFiled,
          message: callbackFiled
            ? "The transfer did not go through. Apologize briefly, say a member of the AltShift team will call back shortly, and ask if there is anything else. Do not try to transfer again and never read a phone number."
            : "The transfer did not go through. Apologize briefly and suggest the caller try again a little later or write to AltShift support from the website. Do not try to transfer again.",
        });
      }
      default:
        return await runTool(name, args, deskSessionId);
    }
  };

  const processFunctionCalls = async (calls: Record<string, unknown>[], modelSpoke: boolean, spokenChars: number) => {
    clearSilence();
    let wantsEnd = false;
    let sentOutput = false;
    toolsInFlight += 1;
    const stopFillers = startFillers(modelSpoke, calls.some((c) => !NO_FILLER.has(String(c.name ?? ""))));
    try {
      for (const item of calls) {
        const name = String(item.name ?? "");
        const fnCallId = String(item.call_id ?? "");
        if (!name || !fnCallId || seenCalls.has(fnCallId)) continue;
        seenCalls.add(fnCallId);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(item.arguments ?? "{}"));
        } catch {
          args = {};
        }
        if (name === "end_call" || name === "close_session") {
          wantsEnd = true;
          continue;
        }
        let output = await handleFn(name, args, { modelSpoke, spokenChars });
        if (output === null) return; // transferred away
        if (toolFailed(output)) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 2) {
            try {
              const parsed = JSON.parse(output);
              parsed.escalate = transferTried || name === "transfer_to_human"
                ? "Two attempts have failed. Apologize briefly and offer a callback (request_callback)."
                : "Two attempts have failed. If the caller still needs help, say the one-line transfer notice and call transfer_to_human (trigger unresolved_after_two_attempts). For an emergency, give the 9-1-1 instruction instead.";
              output = JSON.stringify(parsed);
            } catch { /* keep */ }
          }
        } else consecutiveFailures = 0;
        if (hungUp || handedOff) return;
        send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: fnCallId, output } });
        sentOutput = true;
      }
    } finally {
      stopFillers();
      toolsInFlight -= 1;
    }
    if (hungUp || handedOff) return;
    if (wantsEnd) {
      void runTool("close_session", {}, deskSessionId, 4000);
      if (modelSpoke) hangUpAfterAudio(audioPlaying ? 12_000 : sawAudioBufferEvents ? 600 : spokenChars * 75 + 800);
      else {
        ending = true;
        createResponse(say(lang === "fr" ? "Merci d'avoir appelé AltShift. Bonne journée!" : "Thank you for calling AltShift. Have a good day."));
      }
      return;
    }
    if (sentOutput) createResponse();
  };

  /* ---------- relay to a fresh worker ---------- */
  const relay = async (reason: string) => {
    if (relaying || handedOff || hungUp || finished) return;
    if (transferring) {
      // Never relay mid-transfer; try again once the REFER settles.
      timers.push(setTimeout(() => void relay(reason), 1000));
      return;
    }
    relaying = true;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (hop + 1 > MAX_HOPS) {
      console.log(tag, "max hops reached; wrapping up");
      send({ type: "session.update", session: { type: "realtime", tools: [], instructions: T.wrapUp[lang] } });
      return;
    }
    const post = (mode: "overlap" | "after_close") =>
      fetch(`${supabaseUrl}/functions/v1/openai-live-sip-webhook`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: RELAY_EVENT,
          mode,
          call_id: callId,
          desk_session_id: deskSessionId,
          state: { lang, failures: consecutiveFailures, hop: hop + 1, transferTried } satisfies RelayState,
        }),
        signal: AbortSignal.timeout(12_000),
      }).then((r) => r.ok).catch(() => false);
    console.log(tag, "relay start", reason);
    if (await post("overlap")) {
      handedOff = true;
      console.log(tag, "relay ok (overlap)");
      finish();
      return;
    }
    // OpenAI may allow only one sideband per call: release ours, then let the new worker connect.
    handedOff = true;
    ws.close();
    const ok = await post("after_close");
    console.log(tag, ok ? "relay ok (after close)" : "relay failed; call continues without sideband");
    finish();
  };

  /* ---------- lifecycle ---------- */
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => (resolveDone = r));
  const timers: ReturnType<typeof setTimeout>[] = [];
  function finish() {
    if (finished) return;
    finished = true;
    clearSilence();
    timers.forEach(clearTimeout);
    if (hangupTimer) clearTimeout(hangupTimer);
    if (createPendingTimer) clearTimeout(createPendingTimer);
    keypadCapture?.resolve("");
    try { ws.close(); } catch { /* ignore */ }
    resolveDone();
  }

  const elapsed = () => Date.now() - startedAt;
  // Soft window: relay at the first idle moment. Hard deadline: relay regardless.
  timers.push(setTimeout(function idleCheck() {
    if (finished || relaying) return;
    const idle = toolsInFlight === 0 && !keypadCapture && !busy() && !audioPlaying && !ending;
    if (idle) void relay("idle_window");
    else timers.push(setTimeout(idleCheck, 500));
  }, Math.max(RELAY_SOFT_MS - elapsed(), 1000)));
  timers.push(setTimeout(() => void relay("hard_deadline"), Math.max(RELAY_HARD_MS - elapsed(), 2000)));
  if (languageMenuPending) timers.push(setTimeout(() => (languageMenuPending = false), LANGUAGE_MENU_MS));
  try {
    addEventListener("beforeunload", () => {
      if (!finished && !relaying && !hungUp) void relay("beforeunload");
    });
  } catch { /* not supported */ }

  const onMessage = async (raw: string) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = String(msg.type ?? "");
    switch (type) {
      case "response.created": {
        const id = String((msg.response as { id?: string } | undefined)?.id ?? "");
        createPending = false;
        if (createPendingTimer) clearTimeout(createPendingTimer);
        if (id) active.add(id);
        clearSilence();
        return;
      }
      case "output_audio_buffer.started":
        sawAudioBufferEvents = true;
        audioPlaying = true;
        clearSilence();
        return;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        sawAudioBufferEvents = true;
        audioPlaying = false;
        if (ending && !busy()) {
          if (hangupTimer) clearTimeout(hangupTimer);
          hangupTimer = setTimeout(() => void hangUpNow("after_goodbye"), 400);
        } else armSilence();
        return;
      case "input_audio_buffer.speech_started":
        callerSpeaking = true;
        silenceStage = 0;
        // Once the caller talks, the model picks the language from speech; later 1/2 keys are menu answers.
        languageMenuPending = false;
        clearSilence();
        return;
      case "input_audio_buffer.speech_stopped":
        callerSpeaking = false;
        return;
      case "response.done": {
        const response = (msg.response ?? {}) as Record<string, unknown>;
        const id = String(response.id ?? "");
        if (id) active.delete(id);
        const outputItems = Array.isArray(response.output) ? response.output as Record<string, unknown>[] : [];
        const messages = outputItems.filter((i) => i.type === "message");
        const spokenChars = messages.reduce((n, m) => {
          const content = Array.isArray(m.content) ? m.content as Record<string, unknown>[] : [];
          return n + content.reduce((k, c) => k + String(c.transcript ?? c.text ?? "").length, 0);
        }, 0);
        if (response.status === "failed") {
          const err = (response.status_details as { error?: { code?: string; type?: string } } | undefined)?.error;
          console.error(tag, "response failed", err?.type ?? "", err?.code ?? "");
        }
        if (pendingInterruptedInput) {
          const next = pendingInterruptedInput;
          pendingInterruptedInput = null;
          sendInput(next);
          return;
        }
        const calls = response.status === "completed" ? outputItems.filter((i) => i.type === "function_call") : [];
        if (calls.length) {
          await processFunctionCalls(calls, messages.length > 0, spokenChars);
          flushQueue();
          return;
        }
        if (queue.length) {
          flushQueue();
          return;
        }
        if (ending) {
          // output_audio_buffer.stopped shortcuts this; the timer is the safety net.
          hangUpAfterAudio(audioPlaying ? 12_000 : sawAudioBufferEvents ? 1500 : spokenChars * 75 + 800);
          return;
        }
        // Without playback events, estimate how long the audio still plays (~13 chars/s).
        if (!sawAudioBufferEvents) armSilence(Math.min(spokenChars * 75, 15_000));
        else if (!audioPlaying) armSilence();
        return;
      }
      case "transport.dtmf.received":
      case "input_audio_buffer.dtmf_event_received": {
        const key = String(msg.event ?? msg.digit ?? "");
        silenceStage = 0;
        clearSilence();
        if (keypadCapture) {
          const c = keypadCapture;
          if (key === "*") {
            c.digits = "";
            if (c.submitTimer) clearTimeout(c.submitTimer);
          } else if (key === "#") {
            if (c.digits.length >= c.min) finishCapture(c.digits);
            else createResponse({ conversation: "none", tool_choice: "none", output_modalities: ["audio"], instructions: T.pinShort[lang] });
          } else if (/^[0-9]$/.test(key) && c.digits.length < c.max) {
            if (busy() || audioPlaying) cancelSpeech();
            if (c.submitTimer) clearTimeout(c.submitTimer);
            c.digits += key;
            if (c.digits.length === c.max) finishCapture(c.digits);
            else if (c.digits.length >= c.min) c.submitTimer = setTimeout(() => finishCapture(keypadCapture?.digits ?? ""), 2500);
          }
          return;
        }
        if (languageMenuPending && (key === "1" || key === "2")) {
          languageMenuPending = false;
          lang = key === "1" ? "fr" : "en";
          void runTool("set_session_language", { language: lang }, deskSessionId, 4000);
          interruptWithInput(lang === "fr"
            ? "[Clavier] Le client a appuyé sur 1 : français. Continuez en français, sans répéter le menu. Demandez brièvement comment vous pouvez l'aider."
            : "[Keypad] The caller pressed 2: English. Continue in English without repeating the menu. Briefly ask how you can help.");
          return;
        }
        if (/^[0-9*#]$/.test(key)) {
          interruptWithInput(`[Keypad] The caller pressed ${key}. Treat it as their answer to your most recent numbered question (1 = yes, 2 = no when that was the question). Do not finish or repeat the interrupted sentence.`);
        }
        return;
      }
      case "error": {
        const err = (msg.error ?? {}) as { type?: string; code?: string; param?: string };
        console.error(tag, "realtime error", err.type ?? "", err.code ?? "", err.param ?? "");
        if (err.code === "conversation_already_has_active_response") {
          createPending = false;
          queue.unshift(lastCreate);
        } else if (createPending) {
          createPending = false;
          flushQueue();
        }
        return;
      }
      case "session.created":
      case "session.updated":
        console.log(tag, type);
        return;
      default:
        return;
    }
  };

  const attach = (socket: RealtimeSocket) => {
    ws = socket;
    socket.onmessage = (raw) => {
      onMessage(raw).catch((e) => console.error(tag, "handler error", errName(e)));
    };
    socket.onclose = async () => {
      if (transferring) {
        // Expected when Telnyx takes the call for the transfer: let attemptLiveTransfer settle it.
        transferSocketClosed = true;
        onTransferSocketClose?.();
        return;
      }
      if (finished || handedOff || hungUp) {
        finish();
        return;
      }
      // Unexpected drop: the call itself may still be up. Try to reattach briefly.
      if (reconnects < 2 && elapsed() < RELAY_HARD_MS) {
        reconnects += 1;
        try {
          const again = await openRealtimeSideband(apiKey, callId, 2);
          console.log(tag, "sideband reconnected");
          active.clear();
          createPending = false;
          attach(again);
          if (toolsInFlight > 0) createResponse(say(lang === "fr" ? "Désolée, un petit problème technique. Je continue." : "Sorry, a brief technical issue. I'm continuing."));
          return;
        } catch {
          console.log(tag, "sideband gone (call likely ended)");
        }
      }
      await markClosed();
      finish();
    };
  };
  attach(ws);

  if (opts.greet) {
    // Accepting a call does not start audio; speak first, right away.
    createResponse({
      tool_choice: "none",
      instructions: `Say exactly, warmly and calmly: "${PHONE_OPENING_LINE}" Then stop and listen.`,
    });
  }

  await done;
}

/* ------------------------------------------------------------------ HTTP */

async function startSideband(params: {
  apiKey: string;
  callId: string;
  deskSessionId: string;
  startedAt: number;
  state: RelayState;
  greet: boolean;
  attempts: number;
}): Promise<{ run: Promise<void> } | null> {
  // Wrapped so awaiting this only waits for the connection, not for the whole call.
  try {
    const socket = await openRealtimeSideband(params.apiKey, params.callId, params.attempts);
    return { run: runCall({ ...params, socket }) };
  } catch (e) {
    console.error("sideband unavailable", params.callId.slice(-8), errName(e));
    return null;
  }
}

function keepAlive(p: Promise<unknown>) {
  try {
    EdgeRuntime.waitUntil(p);
  } catch {
    void p;
  }
}

async function handleRelay(req: Request, body: Record<string, unknown>, startedAt: number): Promise<Response> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(auth, serviceKey)) return json({ error: "forbidden" }, 403);
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const callId = String(body.call_id ?? "");
  const deskSessionId = String(body.desk_session_id ?? "");
  const s = (body.state ?? {}) as Partial<RelayState>;
  if (!apiKey || !callId || !deskSessionId) return json({ error: "bad_relay" }, 400);
  const state: RelayState = {
    lang: s.lang === "en" ? "en" : "fr",
    failures: Number(s.failures ?? 0) || 0,
    hop: Math.min(Number(s.hop ?? 1) || 1, MAX_HOPS + 1),
    transferTried: s.transferTried === true,
  };
  const running = await startSideband({
    apiKey,
    callId,
    deskSessionId,
    startedAt,
    state,
    greet: false,
    attempts: body.mode === "after_close" ? 4 : 1,
  });
  if (!running) return json({ ok: false }, 409);
  keepAlive(running.run.catch((e) => console.error("relay run", errName(e))));
  console.log("sideband relayed", callId.slice(-8), "hop", state.hop);
  return json({ ok: true });
}

const recentWebhookIds = new Set<string>();

Deno.serve(async (req) => {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method === "GET") return json({ status: "ok", service: "openai-live-sip-webhook" });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!apiKey) return json({ error: "openai_not_configured" }, 503);

    const rawBody = await req.text();
    let event: {
      id?: string;
      type?: string;
      data?: { call_id?: string; sip_headers?: SipHeader[] };
    } & Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    if (event.type === RELAY_EVENT) return await handleRelay(req, event, startedAt);

    // Webhook authenticity (Standard Webhooks). "log" reports only; "enforce" rejects.
    const mode = (Deno.env.get("OPENAI_WEBHOOK_SIGNATURE_MODE") ?? "log").trim().toLowerCase();
    if (mode !== "off") {
      const verdict = await verifyOpenAIWebhook(req, rawBody);
      if (verdict !== "ok" && verdict !== "unconfigured") {
        console.error("webhook signature", verdict, mode);
        if (mode === "enforce") return json({ error: "invalid_signature" }, 401);
      } else if (verdict === "unconfigured" && mode === "enforce") {
        console.error("webhook signature enforce requested but OPENAI_WEBHOOK_SECRET is missing");
      }
    }

    const eventType = event.type ?? "";
    console.log("openai webhook", eventType, event.id ?? "");
    if (eventType !== "realtime.call.incoming") return json({ ok: true, ignored: eventType });

    const callId = String(event.data?.call_id ?? "").trim();
    if (!callId) return json({ error: "missing_call_id" }, 400);

    const webhookId = req.headers.get("webhook-id") ?? event.id ?? "";
    if (webhookId && recentWebhookIds.has(webhookId)) return json({ ok: true, duplicate: true });
    if (webhookId) {
      recentWebhookIds.add(webhookId);
      if (recentWebhookIds.size > 500) recentWebhookIds.clear();
    }

    const callerPhone = extractCallerPhone(event.data?.sip_headers);
    const db = admin();

    // Redelivered webhook for a call we already took: don't accept twice.
    try {
      const { data: existing } = await db.from("front_desk_sessions").select("id").eq("openai_call_id", callId).limit(1).maybeSingle();
      if (existing?.id) return json({ ok: true, duplicate: true });
    } catch { /* column missing: continue */ }

    let deskSessionId: string = crypto.randomUUID();
    try {
      const { data: row, error } = await db
        .from("front_desk_sessions")
        .insert({
          channel: "phone",
          language: "fr",
          openai_call_id: callId,
          draft: { openai_call_id: callId, openai_event_id: event.id ?? null, caller_phone_e164: callerPhone },
        })
        .select("id")
        .maybeSingle();
      if (error) console.error("session insert", error.code ?? "error");
      if (row?.id) deskSessionId = row.id as string;
    } catch (e) {
      console.error("session insert", errName(e));
    }

    const accepted = await acceptCall(apiKey, callId, deskSessionId, !!callerPhone);
    console.log("realtime accept", callId.slice(-8), accepted.status);

    if (!accepted.ok) {
      console.error("accept failed", accepted.status, accepted.text.slice(0, 200));
      // Release the caller quickly; Telnyx then plays the short apology (telnyx-texml-openai after_dial).
      const rejected = await openaiPost(`/realtime/calls/${encodeURIComponent(callId)}/reject`, apiKey, { status_code: 480 }, 4000);
      if (!rejected.ok) console.error("reject failed", rejected.status);
      return json({ ok: false, path: "realtime", accept_status: accepted.status });
    }

    const running = await startSideband({
      apiKey,
      callId,
      deskSessionId,
      startedAt,
      state: { lang: "fr", failures: 0, hop: 0 },
      greet: true,
      attempts: 4,
    });
    if (running) keepAlive(running.run.catch((e) => console.error("sideband run", errName(e))));
    else console.error("call accepted without sideband; the model can talk but tools will not run");

    return json({ ok: true, path: "realtime", desk_session_id: deskSessionId, sideband: !!running });
  } catch (e) {
    console.error("webhook failed", errName(e));
    return json({ ok: false, error: "internal_error" }, 500);
  }
});

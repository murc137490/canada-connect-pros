/**
 * Returns TeXML that dials OpenAI Realtime SIP (TLS + SRTP).
 *
 * Based on the deployed version (v5): no <Say> before the dial. Telnyx "alice"
 * is a robotic phone voice, and speaking before <Dial> answers the call so the
 * caller hears ringback before GPT talks. answerOnBridge keeps the original
 * ring until GPT answers, then GPT speaks first.
 *
 * Added: a Dial `action` so a failed/unanswered SIP leg (OpenAI down, call
 * rejected, timeout) ends with a short bilingual apology instead of dead air.
 * Nothing about the phone number, Telnyx app or secrets changes.
 *
 * Live transfer to a person: the phone AI (openai-live-sip-webhook) asks OpenAI to
 * send a SIP REFER on the AI leg. Telnyx then hangs up that leg and fetches
 * `referUrl` (stage=refer) for the caller; we answer with a <Dial> to the team
 * line (FRONT_DESK_HUMAN_TRANSFER_URI, default tel:+14505784500). The Refer-To
 * value from the request is never trusted: only the configured target is dialed.
 * If nobody answers (stage=after_transfer), the caller hears a short apology
 * (a callback ticket was already filed by the AI side) instead of a dropped call.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_ID = Deno.env.get("OPENAI_SIP_PROJECT_ID")?.trim() ||
  "proj_moAq7nzDW37N9uRwFiMlupsu";
const CALLER_ID = Deno.env.get("TELNYX_SMS_FROM")?.trim() || "+14508003177";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");

const XML_HEADERS = { "Content-Type": "application/xml" };
const SELF_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/telnyx-texml-openai` : "";
const DEFAULT_TRANSFER_NUMBER = "+14505784500";
/** Ring the team line this long (seconds) before the apology; short enough to fall back before most voicemail. */
const TRANSFER_RING_SECONDS = 22;

function xmlEscape(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function readParams(req: Request): Promise<URLSearchParams> {
  const url = new URL(req.url);
  if (req.method !== "POST") return url.searchParams;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/x-www-form-urlencoded")) return new URLSearchParams(await req.text());
    if (type.includes("application/json")) {
      const body = await req.json() as Record<string, unknown>;
      return new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v ?? "")]));
    }
  } catch { /* fall through */ }
  return url.searchParams;
}

/** TeXML noun for the live-transfer target. Same env + default as openai-live-sip-webhook. */
export function transferNoun(raw = Deno.env.get("FRONT_DESK_HUMAN_TRANSFER_URI")): string {
  const value = (raw ?? "").trim();
  const tel = value.match(/^(?:tel:)?(\+[1-9]\d{7,14})$/i);
  if (tel) return `<Number>${xmlEscape(tel[1])}</Number>`;
  if (/^sips?:[^\s<>"@]+@[^\s<>"]+$/i.test(value)) return `<Sip>${xmlEscape(value)}</Sip>`;
  if (value) console.error("FRONT_DESK_HUMAN_TRANSFER_URI has an unsupported format; using the default");
  return `<Number>${DEFAULT_TRANSFER_NUMBER}</Number>`;
}

const TRANSFER_APOLOGY = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA" voice="alice">Désolé, aucun membre de notre équipe n'est disponible pour le moment. Quelqu'un d'AltShift vous rappellera sous peu. Merci.</Say>
  <Say language="en-US" voice="alice">Sorry, no one from our team is available right now. Someone from AltShift will call you back shortly. Thank you.</Say>
  <Hangup/>
</Response>`;

const APOLOGY = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA" voice="alice">Désolé, notre assistant AltShift n'est pas disponible pour le moment. Veuillez rappeler un peu plus tard. Merci.</Say>
  <Say language="en-US" voice="alice">Sorry, the AltShift assistant is not available right now. Please call again a little later. Thank you.</Say>
  <Hangup/>
</Response>`;

const HANGUP = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");

  if (stage === "refer") {
    // The AI leg sent a SIP REFER (live transfer): bridge the caller to the team line.
    const params = await readParams(req);
    const hasTarget = [...params.keys()].some((k) => /refer/i.test(k));
    console.log("texml refer -> transfer to team", hasTarget ? "refer_params" : "no_refer_params");
    const action = SELF_URL
      ? ` action="${xmlEscape(`${SELF_URL}?stage=after_transfer`)}" method="POST"`
      : "";
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${xmlEscape(CALLER_ID)}" timeout="${TRANSFER_RING_SECONDS}" timeLimit="3600"${action}>
    ${transferNoun()}
  </Dial>
</Response>`;
    return new Response(xml, { status: 200, headers: XML_HEADERS });
  }

  if (stage === "after_transfer") {
    const params = await readParams(req);
    const status = (params.get("DialCallStatus") ?? "").toLowerCase();
    console.log("texml after transfer", status || "unknown");
    // completed = the team picked up and the call ended; canceled = the caller hung up while ringing.
    const xml = status === "completed" || status === "canceled" ? HANGUP : TRANSFER_APOLOGY;
    return new Response(xml, { status: 200, headers: XML_HEADERS });
  }

  if (stage === "after_dial") {
    const params = await readParams(req);
    const status = (params.get("DialCallStatus") ?? "").toLowerCase();
    console.log("texml after dial", status || "unknown");
    // completed = the AI call ran and ended normally; canceled = the caller hung up first.
    const xml = status === "completed" || status === "canceled" ? HANGUP : APOLOGY;
    return new Response(xml, { status: 200, headers: XML_HEADERS });
  }

  const sipUri = `sip:${PROJECT_ID}@sip.api.openai.com;transport=tls;secure=srtp`;
  const action = SELF_URL
    ? ` action="${xmlEscape(`${SELF_URL}?stage=after_dial`)}" method="POST"` +
      ` referUrl="${xmlEscape(`${SELF_URL}?stage=refer`)}" referMethod="POST"`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" callerId="${xmlEscape(CALLER_ID)}" timeout="45" timeLimit="3600"${action}>
    <Sip>${xmlEscape(sipUri)}</Sip>
  </Dial>
</Response>`;

  console.log("texml dial openai", "method", req.method);
  return new Response(xml, { status: 200, headers: XML_HEADERS });
});

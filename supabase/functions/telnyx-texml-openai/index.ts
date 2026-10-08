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
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_ID = Deno.env.get("OPENAI_SIP_PROJECT_ID")?.trim() ||
  "proj_moAq7nzDW37N9uRwFiMlupsu";
const CALLER_ID = Deno.env.get("TELNYX_SMS_FROM")?.trim() || "+14508003177";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");

const XML_HEADERS = { "Content-Type": "application/xml" };

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
  if (url.searchParams.get("stage") === "after_dial") {
    const params = await readParams(req);
    const status = (params.get("DialCallStatus") ?? "").toLowerCase();
    console.log("texml after dial", status || "unknown");
    // completed = the AI call ran and ended normally; canceled = the caller hung up first.
    const xml = status === "completed" || status === "canceled" ? HANGUP : APOLOGY;
    return new Response(xml, { status: 200, headers: XML_HEADERS });
  }

  const sipUri = `sip:${PROJECT_ID}@sip.api.openai.com;transport=tls;secure=srtp`;
  const action = SUPABASE_URL
    ? ` action="${xmlEscape(`${SUPABASE_URL}/functions/v1/telnyx-texml-openai?stage=after_dial`)}" method="POST"`
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

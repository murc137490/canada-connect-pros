/**
 * Returns TeXML: instant French welcome, then Dial OpenAI SIP (TLS + SRTP).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_ID = Deno.env.get("OPENAI_SIP_PROJECT_ID")?.trim() ||
  "proj_moAq7nzDW37N9uRwFiMlupsu";
const CALLER_ID = Deno.env.get("TELNYX_SMS_FROM")?.trim() || "+14508003177";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const sipUri =
    `sip:${PROJECT_ID}@sip.api.openai.com;transport=tls;secure=srtp`;

  // Answer immediately with Bienvenue so the caller never hears long ring/silence.
  // Then Dial OpenAI Realtime SIP; AI continues language + booking flow.
  // (Do not <Play> a full MP3 here — TeXML waits until playback ends before Dial.)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA" voice="alice">Bienvenue à Alt Shift. Un instant s'il vous plaît.</Say>
  <Dial callerId="${CALLER_ID}" timeout="45" timeLimit="3600">
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`;

  console.log("texml dial openai", sipUri, "method", req.method);
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
});

/**
 * Returns TeXML that dials OpenAI Realtime SIP (TLS + SRTP).
 * Do not <Say> here. Telnyx "alice" is a robotic phone voice, and speaking
 * before <Dial> answers the call so the caller hears ringback before GPT talks.
 * answerOnBridge keeps the original ring until GPT answers, then GPT speaks.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_ID = Deno.env.get("OPENAI_SIP_PROJECT_ID")?.trim() ||
  "proj_moAq7nzDW37N9uRwFiMlupsu";
const CALLER_ID = Deno.env.get("TELNYX_SMS_FROM")?.trim() || "+14508003177";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const sipUri =
    `sip:${PROJECT_ID}@sip.api.openai.com;transport=tls;secure=srtp`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" callerId="${CALLER_ID}" timeout="45" timeLimit="3600">
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`;

  console.log("texml dial openai", sipUri, "method", req.method);
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
});

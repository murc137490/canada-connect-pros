/**
 * Mint OpenAI Realtime (gpt-realtime) ephemeral client secret for Front Desk WebRTC.
 * Also creates a front_desk_sessions row and returns tool config + session_id.
 *
 * Secrets: OPENAI_API_KEY, FRONT_DESK_SECRET (optional shared with tools), SUPABASE_*
 * API key never leaves the server.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FRONT_DESK_INSTRUCTIONS,
  FRONT_DESK_MODEL,
  FRONT_DESK_TOOLS,
  FRONT_DESK_VOICE,
} from "../_shared/frontDeskRealtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!openaiKey) {
    return new Response(
      JSON.stringify({
        error: "openai_not_configured",
        message: "Set OPENAI_API_KEY on Edge Function secrets to enable GPT-Live voice.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const language = body.language === "fr" ? "fr" : "en";
  const channel = body.channel === "phone" ? "phone" : body.channel === "demo" ? "demo" : "web";

  // Optional user auth (preferred for web)
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ") && Deno.env.get("FRONT_DESK_PUBLIC_DEMO") !== "1") {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user && channel === "web") {
      // Still allow session mint for try-out; tools gate on OTP
    }
  }

  const { data: sessionRow, error: sErr } = await admin
    .from("front_desk_sessions")
    .insert({ channel, language, draft: { sample_business: "Les Services AltShift Inc." } })
    .select("id")
    .maybeSingle();
  if (sErr || !sessionRow) {
    return new Response(JSON.stringify({ error: sErr?.message ?? "session_create_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = sessionRow.id as string;
  const instructions =
    FRONT_DESK_INSTRUCTIONS +
    `\n\nCurrent front_desk session_id (pass to every tool): ${sessionId}\nSample business for demo: Les Services AltShift Inc. Support: +1 450 800 3177.`;

  // Ephemeral client secret for browser WebRTC (GA Realtime)
  const secretRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: FRONT_DESK_MODEL,
        instructions,
        audio: {
          output: { voice: FRONT_DESK_VOICE },
        },
        tools: FRONT_DESK_TOOLS,
        tool_choice: "auto",
      },
    }),
  });

  const secretJson = await secretRes.json().catch(() => ({}));
  if (!secretRes.ok) {
    return new Response(
      JSON.stringify({
        error: "openai_client_secret_failed",
        status: secretRes.status,
        detail: secretJson,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const clientSecret =
    (secretJson as { value?: string; client_secret?: { value?: string } }).value ??
    (secretJson as { client_secret?: { value?: string } }).client_secret?.value;

  return new Response(
    JSON.stringify({
      ok: true,
      session_id: sessionId,
      model: FRONT_DESK_MODEL,
      client_secret: clientSecret,
      expires_at: (secretJson as { expires_at?: number }).expires_at,
      tools_url: `${supabaseUrl}/functions/v1/front-desk-tools`,
      instructions_summary: "AltShift Front Desk — no web search; tools only.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

// Paste this into Supabase Edge Function "ai-chat-hf" (replaces the old api-inference URL).
// Hugging Face deprecated api-inference.huggingface.co; we now use router.huggingface.co.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.27.0";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
// Use capital F if your HF provider list shows "Featherless-Chat-Models"
const HF_MODEL = "Featherless-Chat-Models/Mistral-7B-Instruct-v0.2:featherless-ai";

const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!HF_KEY) console.warn("HUGGINGFACE_API_KEY not set");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.warn("Supabase env not set");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatRequest {
  message?: string;
  access_token?: string;
  language?: "en" | "fr";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const json: ChatRequest = await req.json().catch(() => ({}));
    const userMessage = (json.message || "").toString().trim();
    const accessToken = typeof (json as { access_token?: string }).access_token === "string" ? (json as { access_token: string }).access_token : null;
    const language = json.language === "fr" ? "fr" : "en";

    if (!userMessage)
      return new Response(JSON.stringify({ error: "missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "missing access_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: services, error } = await supabase
      .from("services")
      .select("name, description")
      .limit(5);

    let context = "";
    if (error) {
      console.warn("Supabase select error", error.message);
    } else if (services?.length) {
      context = services
        .map((s: { name?: string; description?: string }, i: number) =>
          `${i + 1}. ${s.name}${s.description ? " - " + s.description : ""}`
        )
        .join("\n");
    }

    const langInstruction = language === "fr"
      ? " You must reply only in French (Français). Répondez toujours en français."
      : " You must reply only in English.";
    const systemContent = (context
      ? `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Use the following database results when relevant to answer the user.\n\nDatabase results:\n${context}\n\nBe friendly, helpful, and concise. Phone: 1-800-PREMIERE. Email: premiereservicescontact@gmail.com. If you don't know something, direct users to contact support.`
      : `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Help customers find and hire verified pros. Be friendly and concise. Phone: 1-800-PREMIERE. Email: premiereservicescontact@gmail.com.`) + langInstruction;

    const hfResp = await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userMessage },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!hfResp.ok) {
      const text = await hfResp.text();
      console.error("HuggingFace router error:", hfResp.status, text);
      let details = text;
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        details = parsed.message || parsed.error || text;
      } catch {
        // keep raw text
      }
      return new Response(
        JSON.stringify({ error: "HuggingFace API error", details }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hfJson = (await hfResp.json()) as { choices?: { message?: { content?: string } }[] };
    const generated = hfJson?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({
        message: generated,
        sources: services || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Function error", err);
    return new Response(
      JSON.stringify({ error: "internal_error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

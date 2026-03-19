# What to paste in Supabase (router API)

Both functions must use **https://router.huggingface.co/v1/chat/completions** (the old api-inference URL is deprecated and no longer works).

---

## 1. Function: ai-chat-hf

1. Supabase → **Edge Functions** → open **ai-chat-hf**.
2. **Delete all** code in the editor.
3. **Paste** the block below (includes auth via `access_token` in body and clearer 502 error details).
4. Click **Deploy**.

If you still get 502, the Support chat will now show the exact Hugging Face error. If it says the model is not supported, try changing `HF_MODEL` to the exact id shown in [HF Models with Featherless](https://huggingface.co/models?inference_provider=featherless-ai) (e.g. `featherless-Chat-Models/...` with lowercase `f` if that’s what the UI shows).

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.27.0";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
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

    const systemContent = context
      ? `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Use the following database results when relevant to answer the user.\n\nDatabase results:\n${context}\n\nBe friendly, helpful, and concise. Phone: 1-800-PREMIERE. Email: premiereservicescontact@gmail.com. If you don't know something, direct users to contact support.`
      : `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Help customers find and hire verified pros. Be friendly and concise. Phone: 1-800-PREMIERE. Email: premiereservicescontact@gmail.com.`;

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
```

---

## 2. Function: search-suggestions

1. Supabase → **Edge Functions** → open **search-suggestions**.
2. **Delete all** code in the editor.
3. **Paste** the block below.
4. Click **Deploy**.

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2:fastest";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json().catch(() => ({}));

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [], summary: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HF_KEY) {
      return new Response(
        JSON.stringify({ error: "HUGGINGFACE_API_KEY is not configured", suggestions: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = `You are a Canadian home services assistant for Premiere Services. The user describes a project or need in their own words. Your job is to:
1. Summarize their request in one short, clear sentence (simplified request) that captures what they need.
2. Suggest 4–6 specific services that match their need. Use exact service names we offer, e.g. "Plumber", "Snow Removal", "House Cleaning", "Landscaping", "HVAC System", "Moving", "Electrician", "Roof Repair", "Window Replacement", "Painting", "Fence Installation", "Pool Cleaning", "Pest Control", "Home Inspection", "Accountant", "Photography", "Catering", "Tutoring", "Dog Walking", "Massage Therapy", etc.

Return valid JSON only, no markdown or extra text:
{"summary": "your one-sentence simplified summary", "suggestions": ["Service A", "Service B", "Service C", ...]}`;

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
          { role: "user", content: query.trim() },
        ],
        max_tokens: 350,
        temperature: 0.5,
      }),
    });

    if (!hfResp.ok) {
      const text = await hfResp.text();
      console.error("HuggingFace router error:", hfResp.status, text);
      let errDetail: string;
      try {
        const errJson = JSON.parse(text) as { error?: string; message?: string };
        errDetail = errJson.error || errJson.message || text.slice(0, 200);
      } catch {
        errDetail = text.slice(0, 200);
      }
      return new Response(
        JSON.stringify({
          error: "HuggingFace API error",
          details: errDetail,
          hfStatus: hfResp.status,
          suggestions: [],
          summary: query.trim(),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hfJson = (await hfResp.json()) as { choices?: { message?: { content?: string } }[] };
    let generated = hfJson?.choices?.[0]?.message?.content ?? "";

    generated = generated.replace(/^```json?\s*|\s*```$/g, "").trim();

    let parsed: { summary?: string; suggestions?: string[] } = {};
    try {
      parsed = JSON.parse(generated);
    } catch {
      const match = generated.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { summary: query.trim(), suggestions: [] };
        }
      } else {
        parsed = { summary: query.trim(), suggestions: [] };
      }
    }

    return new Response(
      JSON.stringify({
        summary: parsed.summary || query.trim(),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search suggestions error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
        suggestions: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Summary

| Function          | Paste the block above labeled for that function | Then Deploy |
|------------------|--------------------------------------------------|-------------|
| **ai-chat-hf**   | First code block                                 | Yes         |
| **search-suggestions** | Second code block                          | Yes         |

Both now call **router.huggingface.co** and use the **chat completions** format (`model` + `messages`). Keep **HUGGINGFACE_API_KEY** set in Edge Function secrets.

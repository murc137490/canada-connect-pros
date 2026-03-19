# Supabase: Hugging Face as sole AI (Support + Main menu)

Use this so **Hugging Face** powers both the Support chat and the main menu “Describe your project” — no OpenAI.

**Important:** Hugging Face deprecated `api-inference.huggingface.co`. Both functions must use **`https://router.huggingface.co/v1/chat/completions`** (see below). Also ensure your HF token has **“Make calls to Inference Providers”** (or use a **Write** token): [Create token](https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained).

---

## Summary

| Function | Action | Used by |
|----------|--------|--------|
| **search-suggestions** | **REPLACE** code (see below) | Main menu “Describe your project” |
| **ai-chat-hf** | **KEEP** as is | Support page AI assistant |
| **chat** | **DELETE** (optional) | Not used — app uses ai-chat-hf |
| **ai-assistant** | **DELETE** (optional) | Not used by this app |

**Secrets:** You already have **HUGGINGFACE_API_KEY**. No OpenAI key needed.

---

## Step 1: Replace `search-suggestions` code

1. In Supabase go to **Edge Functions** → open **search-suggestions**.
2. **Delete all** existing code in the editor.
3. **Paste** the code below (Hugging Face version).
4. Click **Deploy** (or Save then Deploy).

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";

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

    const systemPrompt = `You are a Canadian home services assistant for Premiere Services. The user describes a project or need in their own words. Your job is to:
1. Summarize their request in one short, clear sentence (simplified request) that captures what they need.
2. Suggest 4–6 specific services that match their need. Use exact service names we offer, e.g. "Plumber", "Snow Removal", "House Cleaning", "Landscaping", "HVAC System", "Moving", "Electrician", "Roof Repair", "Window Replacement", "Painting", "Fence Installation", "Pool Cleaning", "Pest Control", "Home Inspection", "Accountant", "Photography", "Catering", "Tutoring", "Dog Walking", "Massage Therapy", etc.

Return valid JSON only, no markdown or extra text:
{"summary": "your one-sentence simplified summary", "suggestions": ["Service A", "Service B", "Service C", ...]}`;

    const prompt = `<s>[INST] ${systemPrompt}\n\nUser request: ${query.trim()} [/INST]`;

    const hfResp = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 350, temperature: 0.5, do_sample: true },
      }),
    });

    if (!hfResp.ok) {
      const text = await hfResp.text();
      console.error("HuggingFace API error:", hfResp.status, text);
      return new Response(
        JSON.stringify({ error: "HuggingFace API error", suggestions: [], summary: query.trim() }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hfJson = await hfResp.json();
    let generated = "";
    if (Array.isArray(hfJson) && hfJson[0]?.generated_text) {
      generated = hfJson[0].generated_text;
    } else if (typeof (hfJson as { generated_text?: string }).generated_text === "string") {
      generated = (hfJson as { generated_text: string }).generated_text;
    } else if (typeof hfJson === "string") {
      generated = hfJson;
    }

    if (generated.includes("[/INST]")) {
      generated = generated.split("[/INST]")[1]?.trim() || generated;
    }
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

## Step 2: Update `ai-chat-hf` to use the new router URL

Hugging Face deprecated the old API. **Replace** the code in **ai-chat-hf** with the version that uses `https://router.huggingface.co/v1/chat/completions`.

1. In Supabase go to **Edge Functions** → open **ai-chat-hf**.
2. **Delete all** existing code.
3. **Paste** the full contents of **`supabase/functions/ai-chat-hf-ROUTER-CODE.ts`** from this repo (or the equivalent block from PASTE-IN-DASHBOARD.md).
4. Click **Deploy**.

Your app still calls `.../functions/v1/ai-chat-hf` with `{ "message": "..." }` and expects `{ "message": "..." }`.

---

## Step 3 (optional): Remove unused functions

- **chat** — The app does **not** call this; it uses **ai-chat-hf**. You can delete **chat** in the Dashboard to avoid confusion.
- **ai-assistant** — The app does **not** call this. You can delete **ai-assistant** if you don’t use it elsewhere.

Deleting them is optional; the app will work either way.

---

## Step 4: Check secrets and token permissions

In **Project Settings** → **Edge Functions** → **Secrets** you should have:

- **HUGGINGFACE_API_KEY** — ✅ (you have this)
- SUPABASE_URL / SUPABASE_ANON_KEY — usually set by Supabase ✅

**Token permissions:** If the bot still returns 502 or “HuggingFace API error”, your token may need permission to call the Inference API. In [Hugging Face → Access Tokens](https://huggingface.co/settings/tokens):

- Create a **new** token (or edit the existing one).
- For **Classic** tokens: use **Write** (not Read-only) so it can call the serverless Inference API.
- Or create a **Fine-grained** token and enable **“Make calls to Inference Providers”** (or **“Inference API”**).
- Put the new token value into Supabase secret **HUGGINGFACE_API_KEY**, then **redeploy** both functions.

You do **not** need OPENAI_API_KEY for this app.

---

## Step 5: Test

1. **Main menu:** On the home page, type in “Describe your project or service need…” (e.g. “fix my leaky sink”). After a short delay you should see “We understood: …” and suggestion buttons. If not, check the browser console (F12) for errors.
2. **Support:** Log in, go to Support, and send a message in the AI assistant. You should get a reply from the Hugging Face model.

If something fails, check Edge Function **Logs** in Supabase for the exact error.

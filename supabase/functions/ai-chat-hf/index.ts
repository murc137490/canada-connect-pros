/**
 * Support AI: Gemini when GOOGLE_GENERATIVE_AI_API_KEY is set, else Hugging Face router.
 * Deploy as Edge Function `ai-chat-hf`.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.27.0";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "Featherless-Chat-Models/Mistral-7B-Instruct-v0.2:featherless-ai";

const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || "";
const GOOGLE_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "";
const GEMINI_CHAT_MODEL = (Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-3.6-flash").trim();
/** Extra Gemini models tried when the primary is overloaded / missing. */
const GEMINI_CHAT_FALLBACKS = (Deno.env.get("GEMINI_CHAT_FALLBACKS") || "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!GOOGLE_KEY && !HF_KEY) console.warn("Neither GOOGLE_GENERATIVE_AI_API_KEY nor HUGGINGFACE_API_KEY is set");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.warn("Supabase env not set");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Turn {
  role: string;
  content: string;
}

interface ChatRequest {
  message?: string;
  access_token?: string;
  language?: "en" | "fr";
  system_extension?: string;
  intent?: string;
  conversation_history?: Turn[];
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function chatWithGeminiModel(
  model: string,
  messages: ChatMsg[],
  maxTokens: number,
  _temperature: number,
): Promise<string> {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_KEY)}`;
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      // Gemini 3 thinking can consume the budget; keep headroom for the visible reply.
      maxOutputTokens: Math.max(maxTokens, 2048),
      thinkingConfig: { thinkingLevel: "MINIMAL" },
    },
  };
  if (systemParts) {
    body.systemInstruction = { parts: [{ text: systemParts }] };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini ${model} ${resp.status}: ${text.slice(0, 800)}`);
  }
  const json = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const text =
    json?.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  if (!text) throw new Error(`Gemini ${model} returned empty content`);
  return text;
}

/** Try primary Gemini → short retry on 503 → other Gemini models → Hugging Face. */
async function chatWithProviderChain(
  messages: ChatMsg[],
  maxTokens: number,
  temperature: number,
): Promise<{ text: string; provider: string }> {
  const geminiModels = [GEMINI_CHAT_MODEL, ...GEMINI_CHAT_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );

  if (GOOGLE_KEY) {
    for (const model of geminiModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const text = await chatWithGeminiModel(model, messages, maxTokens, temperature);
          return { text, provider: `gemini:${model}` };
        } catch (err) {
          const msg = String(err);
          const overloaded = /\b503\b|UNAVAILABLE|high demand/i.test(msg);
          console.error(`Gemini ${model} attempt ${attempt + 1} failed:`, msg.slice(0, 200));
          if (overloaded && attempt === 0) {
            await sleep(400);
            continue;
          }
          break;
        }
      }
    }
  }

  if (HF_KEY) {
    const text = await chatWithHf(messages, maxTokens, temperature);
    if (!text) throw new Error("HuggingFace returned empty content");
    return { text, provider: "huggingface" };
  }

  throw new Error("All AI providers unavailable");
}

function staticProviderDownMessage(language: "en" | "fr"): string {
  return language === "fr"
    ? "L’assistant est temporairement saturé. Écrivez-nous à support@premiereservices.ca (réponse sous 24 h) ou composez le +1 450 910 1400 (lun–ven, 8 h–20 h HE). Nous sommes là pour vous aider."
    : "Our AI assistant is temporarily busy. Email support@premiereservices.ca (we reply within 24 hours) or call +1 450 910 1400 (Mon–Fri, 8am–8pm EST). We’re happy to help.";
}

async function chatWithHf(messages: ChatMsg[], maxTokens: number, temperature: number): Promise<string> {
  const hfResp = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!hfResp.ok) {
    const text = await hfResp.text();
    throw new Error(`HuggingFace ${hfResp.status}: ${text.slice(0, 800)}`);
  }
  const hfJson = (await hfResp.json()) as { choices?: { message?: { content?: string } }[] };
  return hfJson?.choices?.[0]?.message?.content?.trim() ?? "";
}


// --- Topic gate: block only obvious non-Premiere retail / unrelated queries (no LLM). ---

function matchesHardOffTopic(text: string): boolean {
  const q = text.trim();
  if (!q) return false;

  const hasPremiereTie = /\b(premiere|première|website|site|platform|app|booking|account|pro\b|professional)\b/i.test(q);

  if (
    /\b(buy|buying|purchase|shop(ping)?\s+for|where\s+(to\s+)?buy|get\s+skis|get\s+a\s+snowboard)\b/i.test(q) &&
    /\b(skis|ski\b|snowboard|ski\s*boots|bottes\s+de\s+ski)\b/i.test(q) &&
    !hasPremiereTie
  ) {
    return true;
  }

  if (
    /\b(recommend|best|good|looking\s+for)\s+.+\b(skis|snowboard|ski\s+boots)\b/i.test(q) &&
    !/\b(pro|professional|hire|booking|premiere)\b/i.test(q)
  ) {
    return true;
  }

  if (
    /\b(skis|snowboard|ski\s*boots)\b/i.test(q) &&
    !hasPremiereTie &&
    /\b(help\s+me\s+(pick|choose|find)|which\s+(ski|skis)|what\s+(ski|skis)|pick\s+(some\s+)?skis|choose\s+(my\s+)?skis)\b/i.test(q)
  ) {
    return true;
  }

  if (
    /\b(book\s+a\s+flight|weather\s+in|recipe\s+for|homework|write\s+my\s+essay|investment\s+advice|medical\s+advice|legal\s+advice)\b/i.test(
      q
    )
  ) {
    return true;
  }

  if (
    /\b(walmart|target\.com|amazon|best\s*buy|costco)\b/i.test(q) &&
    /\b(buy|buying|purchase|shop|which\s+(ones?\s+)?(are\s+)?(the\s+)?best|recommend)\b/i.test(q) &&
    /\b(speakers?|headphones?|tv|television|laptop|iphone)\b/i.test(q) &&
    !hasPremiereTie
  ) {
    return true;
  }

  if (
    /\b(walmart|target\.com|amazon|best\s*buy|costco)\b/i.test(q) &&
    /\b(cheapest|cheaper|cheap|price|priced|cost|how\s+much|sells?|carry|carries)\b/i.test(q) &&
    /\b(speakers?|headphones?|earbuds?|tv|television|laptop|iphone|phone|tablet|gadget)\b/i.test(q) &&
    !hasPremiereTie
  ) {
    return true;
  }

  return false;
}

type TopicGateResult = { allowed: true } | { allowed: false; reason: "off_topic" };

/**
 * Allow almost everything through to the model (benefit of the doubt + clarifying questions).
 * Block only obvious non-Premiere topics (retail product shopping, etc.) to save API cost.
 */
function evaluateSupportTopicGate(userMessage: string, _history: Turn[]): TopicGateResult {
  const msg = userMessage.trim();
  if (!msg) return { allowed: false, reason: "off_topic" };

  if (matchesHardOffTopic(msg)) return { allowed: false, reason: "off_topic" };

  return { allowed: true };
}

function staticOffTopicRefusal(language: "en" | "fr"): string {
  return language === "fr"
    ? "Je suis uniquement là pour vous aider avec Premiere Services (la plateforme, votre compte, les réservations et les services à domicile offerts sur le site). Ce message ne semble pas lié à nos services — si vous avez une question sur Premiere Services, écrivez à support@premiereservices.ca."
    : "I'm only here to help with Premiere Services — the platform, your account, bookings, and home services offered through our marketplace. This doesn't look related to what we offer. For Premiere-related questions, email support@premiereservices.ca.";
}

// --- end topic gate ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const json = (await req.json().catch(() => ({}))) as ChatRequest;
    const userMessage = (json.message || "").toString().trim();
    const accessToken = typeof json.access_token === "string" ? json.access_token : null;
    const language = json.language === "fr" ? "fr" : "en";
    const systemExtension =
      typeof json.system_extension === "string" && json.system_extension.trim()
        ? "\n\n" + json.system_extension.trim()
        : "";
    const intent = json.intent === "support_help" ? "support_help" : "default";

    const rawHistory = Array.isArray(json.conversation_history) ? json.conversation_history : [];
    const conversationHistory = rawHistory
      .filter((t) => t && (t.role === "user" || t.role === "assistant"))
      .map((t) => ({
        role: t.role as "user" | "assistant",
        content: String(t.content ?? "").slice(0, 8000),
      }))
      .slice(-16);

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "missing access_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (intent === "support_help") {
      const gate = evaluateSupportTopicGate(userMessage, conversationHistory);
      if (!gate.allowed) {
        return new Response(
          JSON.stringify({
            message: staticOffTopicRefusal(language),
            topic_blocked: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    let systemContent: string;
    let maxTokens = 256;
    let temperature = 0.55;
    let serviceSources: { name?: string; description?: string }[] = [];

    if (intent === "support_help") {
      systemContent =
        language === "fr"
          ? `Tu es l'assistant support de Premiere Services (marché canadien de services à domicile). Tu aides clients et pros.

**Style conversationnel (important) :**
- Ne dump pas une longue liste d’étapes d’un coup.
- Pose **une** question courte pour avancer (ex. « Avez-vous déjà un compte Premiere Services ? »).
- Ensuite donne **seulement la prochaine action** avec un lien cliquable.
- Réponses courtes (2–4 phrases). Jamais de phrase coupée. Ne répète pas ton rôle.

**Liens (toujours URL complète https) :**
- Devenir pro : [Join Pros](https://www.premiereservices.ca/join-pros)
- Créer un compte : [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Se connecter : [Log in](https://www.premiereservices.ca/auth?mode=login&redirect=/join-pros)
- Forfaits pro : [Pro plans](https://www.premiereservices.ca/pro-plans)
- Tableau de bord : [Dashboard](https://www.premiereservices.ca/dashboard)
- Support : support@premiereservices.ca · +1 450 910 1400

**Créer un compte pro — parcours guidé :**
1. Demande s’ils ont déjà un compte.
2. Non → lien Sign up ci-dessus. Oui → lien Log in, puis Join Pros.
3. Après connexion → compléter le profil sur Join Pros, puis forfait sur Pro plans.
4. Mentionne qu’une approbation admin peut être requise avant d’apparaître en recherche.
N’invente pas d’autres URLs.

Langue : **français uniquement** (sauf noms propres / URL).`
          : `You are the Premiere Services support assistant for a Canadian home services marketplace. You help customers and pros.

**Conversational style (important):**
- Do **not** dump a long numbered checklist in one reply.
- Ask **one** short clarifying question first (e.g. “Do you already have a Premiere Services account?”).
- Then give **only the next action** with a markdown link AND the full URL on its own line.
- Example format:
  Do you already have an account?
  If not: [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Keep replies short (2–4 sentences). Never cut off mid-sentence. Don’t restate your role.

**Links (always full https URLs, use markdown [label](url)):**
- Become a pro: [Join Pros](https://www.premiereservices.ca/join-pros)
- Create an account: [Sign up](https://www.premiereservices.ca/auth?mode=signup&redirect=/join-pros)
- Log in: [Log in](https://www.premiereservices.ca/auth?mode=login&redirect=/join-pros)
- Pro plans: [Pro plans](https://www.premiereservices.ca/pro-plans)
- Dashboard: [Dashboard](https://www.premiereservices.ca/dashboard)
- Support: support@premiereservices.ca · +1 450 910 1400 (Mon–Fri, 8am–8pm EST)

**Create a pro account — guided flow:**
1. Ask if they already have an account.
2. No → send the Sign up link above. Yes → Log in link, then Join Pros.
3. After login → complete the pro profile on Join Pros, then choose a plan on Pro plans when prompted.
4. Mention admin approval may be needed before appearing in search.
Don’t invent other URLs.

Language: **English only** (proper nouns / URLs excepted).`;
      maxTokens = 1024;
      temperature = 0.4;
    } else {
      const { data: services, error } = await supabase.from("services").select("name, description").limit(5);
      serviceSources = services ?? [];

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

      const langInstruction =
        language === "fr"
          ? " You must reply only in French (Français). Répondez toujours en français."
          : " You must reply only in English.";
      systemContent =
        (context
          ? `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Use the following database results when relevant to answer the user.\n\nDatabase results:\n${context}\n\nBe friendly, helpful, and concise. Phone: 1-800-PREMIERE. Email: support@premiereservices.ca. If you don't know something, direct users to contact support.`
          : `You are the Premiere Services AI support assistant for a Canadian home services marketplace. Help customers find and hire verified pros. Be friendly and concise. Phone: 1-800-PREMIERE. Email: support@premiereservices.ca.`) +
        langInstruction +
        systemExtension;
    }

    type HFMsg = { role: "system" | "user" | "assistant"; content: string };
    let hfMessages: HFMsg[];

    if (intent === "support_help") {
      hfMessages = [{ role: "system", content: systemContent }, ...conversationHistory, { role: "user", content: userMessage }];
    } else {
      hfMessages = [
        { role: "system", content: systemContent },
        { role: "user", content: userMessage },
      ];
    }

    if (!GOOGLE_KEY && !HF_KEY) {
      return new Response(JSON.stringify({ error: "No AI provider configured (set GOOGLE_GENERATIVE_AI_API_KEY or HUGGINGFACE_API_KEY)" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = "";
    let provider = "none";
    try {
      const result = await chatWithProviderChain(hfMessages, maxTokens, temperature);
      generated = result.text;
      provider = result.provider;
    } catch (e) {
      console.error("All AI providers failed:", e);
      // Never surface raw provider errors to the user — always return a usable reply.
      return new Response(
        JSON.stringify({
          message: staticProviderDownMessage(language),
          provider: "static_fallback",
          degraded: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ message: generated, sources: serviceSources, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error", err);
    return new Response(
      JSON.stringify({
        message: staticProviderDownMessage("en"),
        provider: "static_fallback",
        degraded: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

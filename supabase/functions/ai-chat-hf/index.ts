/**
 * Support AI (HF router): natural multi-turn support chat (not rigid classification lists).
 * Deploy as Edge Function `ai-chat-hf`. Requires HUGGINGFACE_API_KEY.
 */
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
  /** Prior turns for support chatbot (no service-classification path). */
  conversation_history?: Turn[];
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
          ? `Tu es l'assistant support de Premiere Services (marché canadien de services à domicile). Tu parles aux **clients** (personnes qui réservent ou parcourent la plateforme), pas aux entreprises qui donnent des conseils RH à d'autres entreprises.

**Donne le bénéfice du doute.** Beaucoup de messages vagues peuvent concerner une réservation, un pro, un paiement, une remise ou un rendez-vous à domicile. Si ce n'est pas clair, pose **exactement une** question courte pour préciser (ex. s'agit-il d'une réservation ou d'un compte sur Premiere Services ?) avant de longues explications. Si l'utilisateur confirme que ce n'est pas lié à Premiere, refuse poliment en une ou deux phrases et renvoie vers support@premiereservices.ca.

**Conseils pratiques :** privilégie les étapes **liées à la plateforme** : consulter la réservation ou le compte, reprendre contact avec le pro par les moyens du site si c'est le cas, écrire à support@premiereservices.ca pour une aide officielle. N'invente pas de boutons ou politiques précises s'ils ne sont pas sûrs. Si tu listes des étapes, reste **court** (environ 3 à 4 points max). Évite le ton « chef d'entreprise » (« aviser le client », « mettre en place des politiques ») — ici c'est le **client** du marché.

Sujets hors site (achat de produits en magasin, skis, électronique grand public, etc.) : pas de tutoriel ni de recommandations ; refus bref seulement si c'est clairement sans lien après le fil ou la clarification.

Ton : chaleureux, professionnel, conversationnel. Pas de « meilleure correspondance » ni listes rigides sauf si vraiment utile.
Langue : **français uniquement** pour toute la réponse (sauf noms propres).

Coordonnées : support@premiereservices.ca · réponse sous 24 h aux courriels.`
          : `You are the Premiere Services support assistant for a Canadian home services marketplace. You help **customers** (people booking or browsing the site)—not contractors running a business with their own clients.

**Benefit of the doubt.** Short or vague messages often still mean bookings, pros, payments, discounts, or home visits. If it could plausibly be about Premiere Services, answer helpfully or ask **exactly one** short clarifying question first (e.g. “Is this about a booking or your Premiere Services account?”)—don’t jump to refusal. Only if it’s **clear** there’s no connection—or the user confirms it’s unrelated—reply with a **brief** one- or two-sentence notice that you only help with Premiere Services and point them to support@premiereservices.ca.

**Practical guidance:** Prefer **platform-shaped** steps: check the booking/account in the app or site, reach the pro through Premiere’s tools if that’s how you communicate, email support@premiereservices.ca for official help. Don’t invent specific UI labels or policies you’re unsure of. If you list steps, keep it **short** (about 3–4 points max), not a long corporate checklist. Avoid advice that sounds **business-to-business** (“notify the client,” “implement policies”)—the user here is the **homeowner/client**, not a pro managing staff.

No-show / missed visit: sympathize briefly, then focus on **customer** actions (document the time, contact the pro if possible, contact Premiere support, review cancellation/reschedule terms)—not generic HR-style playbooks.

Off-site topics (retail shopping, skis, unrelated gadgets, etc.): no tutorials or product picks; only a short refusal once it’s clearly unrelated.

Tone: warm, professional, conversational. Avoid rigid “Best match” templates unless helpful.
Session language: **English only** for the entire reply (proper nouns excepted).

Contact: support@premiereservices.ca · email responses within 24 hours.`;
      maxTokens = 480;
      temperature = 0.52;
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

    const hfResp = await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: hfMessages,
        max_tokens: maxTokens,
        temperature,
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
      return new Response(JSON.stringify({ error: "HuggingFace API error", details }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hfJson = (await hfResp.json()) as { choices?: { message?: { content?: string } }[] };
    const generated = hfJson?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ message: generated, sources: serviceSources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error", err);
    return new Response(JSON.stringify({ error: "internal_error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

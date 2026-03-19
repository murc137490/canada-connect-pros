// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "featherless-Chat-Models/Mistral-7B-Instruct-v0.2:featherless-ai";

// Fallback when frontend does not send serviceNames (e.g. old clients)
const SERVICE_NAMES_FALLBACK =
  "Plumber, Electrician, HVAC System, Roof Repair, Window Replacement, Painting, Landscaping, Snow Removal, House Cleaning, Moving, Local Moving, Dog Walking, Pet Sitting, Home Inspection, Exterminator, Locksmith, Massage Therapy, Personal Trainer, Math Tutor, French Tutor, Catering, Photographer, Accountant, Basement Remodel, Bathroom Remodel, Kitchen Remodel, Furnace Repair, AC Repair, Drain Cleaning, Toilet Repair, Deep Cleaning, Office Cleaning, Snow Plowing, Lawn Care, Tree Trimming, Pool Cleaning, and many more specific services. Use ONLY exact names from the list provided.";

function buildSystemEn(serviceList: string): string {
  return `You are a helpful Canadian home services assistant for Premiere Services. The user describes a project or need in their own words. Always respond in English.

Important: (1) If the user writes in another language (e.g. French, Spanish), interpret their intent and still respond in English; translate or infer what they need. (2) Tolerate spelling mistakes and typos. Interpret misspellings as the nearest intended word (e.g. "electrisian" for "electrician", "cleening" for "cleaning"). (3) You MUST suggest only SPECIFIC services from the exact list below. Never suggest only a category name like "Home Improvement" or "Cleaning" — always pick specific services from the list (e.g. Plumber, Bathroom Remodel, House Cleaning, Furnace Repair, Snow Removal).

Your tasks:
1. Summarize their request in one short, clear sentence that captures what they need.
2. If the request is vague, ask 1–2 short clarifying questions in followUpQuestions.
3. Suggest 4–6 specific services that match their need. Use ONLY exact service names from this list — copy the names exactly as written: ${serviceList}
4. Pick the single best-matching service for bestMatch.serviceName (exact name from the list) and its category for bestMatch.categoryName (e.g. Home Improvement, Cleaning, Outdoor & Seasonal).

Return valid JSON only, no markdown or extra text:
{"summary": "one-sentence summary", "suggestions": ["Exact Service A", "Exact Service B", ...], "followUpQuestions": ["optional question?"], "clarifyingMessage": "optional", "bestMatch": {"serviceName": "Exact Service Name from list", "categoryName": "Category Name"}}`;
}

function buildSystemFr(serviceList: string): string {
  return `Tu es l'assistant des services à la maison de Première Services au Canada. L'utilisateur décrit un projet ou un besoin. Réponds toujours en français.

Important : (1) Si l'utilisateur écrit dans une autre langue, interprète son intention et réponds en français. (2) Tolère les fautes d'orthographe. (3) Tu DOIS suggérer uniquement des services SPÉCIFIQUES de la liste exacte ci-dessous. Ne suggère jamais seulement un nom de catégorie comme "Home Improvement" ou "Cleaning" — choisis toujours des services précis de la liste (ex. Plumber, Bathroom Remodel, House Cleaning).

Tes tâches :
1. Résume sa demande en une phrase courte et claire.
2. Si la demande est floue, pose 1–2 questions dans followUpQuestions.
3. Suggère 4–6 services précis. Utilise UNIQUEMENT les noms exacts de cette liste (copie les noms tels quels) : ${serviceList}
4. Choisis le meilleur service pour bestMatch.serviceName (nom exact de la liste) et sa catégorie pour bestMatch.categoryName.

Retourne du JSON valide uniquement :
{"summary": "résumé", "suggestions": ["Service A", "Service B", ...], "followUpQuestions": ["question?"], "clarifyingMessage": "optionnel", "bestMatch": {"serviceName": "Nom exact de la liste", "categoryName": "Nom de catégorie"}}`;
}

/** Fallback when Hugging Face fails: keyword → specific service names (must exist in app) */
const KEYWORD_FALLBACK: { keywords: string[]; services: string[]; category: string }[] = [
  { keywords: ["plumb", "pipe", "leak", "faucet", "toilet", "drain", "water heater", "sump"], services: ["Plumber", "Drain Cleaning", "Water Heater Installation", "Toilet Repair"], category: "Home Improvement" },
  { keywords: ["electric", "wiring", "outlet", "panel", "ev charger", "solar"], services: ["Electrician", "EV Charger Installation", "Solar Panel Installation", "Panel Upgrade"], category: "Home Improvement" },
  { keywords: ["hvac", "furnace", "ac", "heat", "air", "thermostat", "duct"], services: ["HVAC System", "Furnace Repair", "AC Repair", "Air Duct Cleaning"], category: "Home Improvement" },
  { keywords: ["roof", "shingle", "gutter", "ice dam"], services: ["Roof Repair", "Roof Replacement", "Ice Dam Removal"], category: "Home Improvement" },
  { keywords: ["window", "door", "garage door"], services: ["Window Replacement", "Window Repair", "Door Installation", "Garage Door Repair"], category: "Home Improvement" },
  { keywords: ["paint", "painting"], services: ["Interior Painting", "Exterior Painting", "Cabinet Painting"], category: "Home Improvement" },
  { keywords: ["clean", "cleaning", "housekeeping"], services: ["House Cleaning", "Deep Cleaning", "Carpet Cleaning", "Office Cleaning"], category: "Cleaning" },
  { keywords: ["landscape", "lawn", "yard", "garden", "tree"], services: ["Landscaping Design", "Lawn Care", "Tree Trimming", "Tree Removal", "Garden Design"], category: "Outdoor & Seasonal" },
  { keywords: ["snow", "plow", "ice", "driveway"], services: ["Snow Plowing", "Snow Removal", "Ice Dam Removal", "Driveway Salting"], category: "Outdoor & Seasonal" },
  { keywords: ["move", "mover", "moving", "pack"], services: ["Local Moving", "Long Distance Moving", "Packing Services"], category: "Moving & Storage" },
  { keywords: ["dog", "pet", "cat", "walk", "sit"], services: ["Dog Walking", "Pet Sitting", "Dog Grooming"], category: "Pets" },
  { keywords: ["inspect", "inspection"], services: ["Home Inspection"], category: "Home Security & Inspection" },
  { keywords: ["pest", "exterminat", "bug", "rodent"], services: ["Exterminator", "Pest Control"], category: "Home Security & Inspection" },
  { keywords: ["lock", "key", "locksmith"], services: ["Locksmith"], category: "Home Security & Inspection" },
  { keywords: ["massage", "spa", "facial"], services: ["Massage Therapy", "Facial Treatment"], category: "Wellness" },
  { keywords: ["tutor", "lesson", "learn", "math", "french"], services: ["Math Tutor", "French Tutor", "Piano Lessons"], category: "Lessons & Tutoring" },
  { keywords: ["remodel", "renovat", "basement", "bathroom", "kitchen"], services: ["Basement Remodel", "Bathroom Remodel", "Kitchen Remodel"], category: "Home Improvement" },
  { keywords: ["floor", "carpet", "tile", "hardwood"], services: ["Hardwood Flooring", "Carpet Installation", "Tile Installation", "Laminate Flooring"], category: "Home Improvement" },
  { keywords: ["fence", "fencing"], services: ["Fence Installation", "Fence Repair", "Privacy Fence"], category: "Home Improvement" },
  { keywords: ["pool", "hot tub"], services: ["Pool Cleaning", "Pool Installation", "Hot Tub Installation"], category: "Outdoor & Seasonal" },
];

/** Resolve AI suggestion to a canonical name from the app's service list (case-insensitive, then exact) */
function resolveToCanonical(name: string, serviceNames: string[]): string | null {
  if (!name || !serviceNames.length) return null;
  const n = name.trim();
  const lower = n.toLowerCase();
  const exact = serviceNames.find((s) => s === n);
  if (exact) return exact;
  const ci = serviceNames.find((s) => s.toLowerCase() === lower);
  if (ci) return ci;
  const includes = serviceNames.find((s) => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase()));
  if (includes) return includes;
  return null;
}

function fallbackSuggestions(
  query: string,
  serviceNames?: string[]
): { summary: string; suggestions: string[]; bestMatch: { serviceName: string; categoryName: string } | null } {
  const q = query.toLowerCase();
  const matched: string[] = [];
  let best: { serviceName: string; categoryName: string } | null = null;
  for (const row of KEYWORD_FALLBACK) {
    if (row.keywords.some((k) => q.includes(k))) {
      for (const s of row.services) {
        if (!matched.includes(s)) {
          if (!serviceNames || serviceNames.length === 0 || serviceNames.includes(s)) matched.push(s);
        }
      }
      if (!best && row.services.length) {
        const pick = serviceNames?.includes(row.services[0]) ? row.services[0] : row.services.find((s) => !serviceNames || serviceNames.includes(s)) ?? row.services[0];
        best = { serviceName: pick, categoryName: row.category };
      }
    }
  }
  if (matched.length === 0) {
    const defaults = ["House Cleaning", "Plumber", "Electrician", "HVAC System", "Landscaping Design", "Snow Removal"];
    for (const s of defaults) {
      if (!serviceNames || serviceNames.includes(s)) matched.push(s);
      if (matched.length >= 6) break;
    }
    if (matched.length === 0 && serviceNames?.length) matched.push(...serviceNames.slice(0, 6));
    best = matched.length ? { serviceName: matched[0], categoryName: "Home Improvement" } : null;
  }
  return {
    summary: query,
    suggestions: matched.slice(0, 6),
    bestMatch: best,
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  query?: string;
  locale?: "en" | "fr";
  conversationHistory?: ChatMessage[];
  /** Full list of service names from the app — API uses this for exact matching and filtering */
  serviceNames?: string[];
}

interface ParsedResponse {
  summary?: string;
  suggestions?: string[];
  followUpQuestions?: string[];
  clarifyingMessage?: string;
  bestMatch?: { serviceName?: string; categoryName?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const locale = body.locale === "fr" ? "fr" : "en";
    const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
    const serviceNames = Array.isArray(body.serviceNames) ? body.serviceNames.filter((s) => typeof s === "string" && s.trim()) : [];
    const serviceList = serviceNames.length > 0
      ? serviceNames.join(", ")
      : SERVICE_NAMES_FALLBACK;

    if (query.length < 2) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          summary: null,
          followUpQuestions: [],
          clarifyingMessage: null,
          bestMatch: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HF_KEY) {
      const fallback = fallbackSuggestions(query, serviceNames);
      return new Response(
        JSON.stringify({
          summary: fallback.summary,
          suggestions: fallback.suggestions,
          followUpQuestions: [],
          clarifyingMessage: null,
          bestMatch: fallback.bestMatch,
          _fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = locale === "fr" ? buildSystemFr(serviceList) : buildSystemEn(serviceList);
    const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
      { role: "system", content: systemContent },
    ];
    for (const m of conversationHistory) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: (m.content || "").toString() });
      }
    }
    messages.push({ role: "user", content: query });

    const hfResp = await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        max_tokens: 450,
        temperature: 0.5,
      }),
    });

    if (!hfResp.ok) {
      const text = await hfResp.text();
      console.error("HuggingFace router error:", hfResp.status, text);
      const fallback = fallbackSuggestions(query, serviceNames);
      return new Response(
        JSON.stringify({
          summary: fallback.summary,
          suggestions: fallback.suggestions,
          followUpQuestions: [],
          clarifyingMessage: null,
          bestMatch: fallback.bestMatch,
          _fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hfJson = (await hfResp.json()) as { choices?: { message?: { content?: string } }[] };
    let generated = hfJson?.choices?.[0]?.message?.content ?? "";
    generated = generated.replace(/^```json?\s*|\s*```$/g, "").trim();

    let parsed: ParsedResponse = {};
    try {
      parsed = JSON.parse(generated) as ParsedResponse;
    } catch {
      const match = generated.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as ParsedResponse;
        } catch {
          parsed = { summary: query, suggestions: [] };
        }
      } else {
        parsed = { summary: query, suggestions: [] };
      }
    }

    let suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const followUpQuestions = Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [];
    let bestMatch =
      parsed.bestMatch && (parsed.bestMatch.serviceName || parsed.bestMatch.categoryName)
        ? {
            serviceName: String(parsed.bestMatch.serviceName || "").trim() || null,
            categoryName: String(parsed.bestMatch.categoryName || "").trim() || null,
          }
        : null;

    // Link API to search: only return service names that exist in the app (when list provided)
    if (serviceNames.length > 0) {
      suggestions = suggestions
        .map((s) => resolveToCanonical(String(s).trim(), serviceNames))
        .filter((s): s is string => s != null);
      const seen = new Set<string>();
      suggestions = suggestions.filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });
      if (bestMatch?.serviceName) {
        const resolved = resolveToCanonical(bestMatch.serviceName, serviceNames);
        if (resolved) bestMatch = { ...bestMatch, serviceName: resolved };
        else bestMatch = suggestions.length ? { serviceName: suggestions[0], categoryName: bestMatch.categoryName } : null;
      }
    }

    return new Response(
      JSON.stringify({
        summary: parsed.summary || query,
        suggestions,
        followUpQuestions,
        clarifyingMessage:
          typeof parsed.clarifyingMessage === "string" && parsed.clarifyingMessage.trim()
            ? parsed.clarifyingMessage.trim()
            : null,
        bestMatch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Internal error";
    const errDetails = error instanceof Error ? error.stack : String(error);
    console.error("Search suggestions error:", error);
    return new Response(
      JSON.stringify({
        error: errMsg,
        details: errDetails,
        suggestions: [],
        summary: null,
        followUpQuestions: [],
        clarifyingMessage: null,
        bestMatch: null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Serverless HF Inference (fallback). Prefer Gemini when GOOGLE_GENERATIVE_AI_API_KEY is set. */
const HF_EMBED_URL =
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";
const GEMINI_EMBED_MODEL = (Deno.env.get("GEMINI_EMBED_MODEL") || "gemini-embedding-001").trim();
const GEMINI_EMBED_DIM = 768;

interface ServiceRecordForAI {
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  subcategory: string;
  embedText: string;
}

interface CategorySummaryForAI {
  name: string;
  slug: string;
  serviceCount: number;
  subcategories: { name: string; serviceCount: number }[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  query?: string;
  locale?: "en" | "fr";
  conversationHistory?: ChatMessage[];
  serviceNames?: string[];
  serviceRecords?: ServiceRecordForAI[];
  categorySummaries?: CategorySummaryForAI[];
  /** Distinct labels pros list (display_name + catalog slug); used only for "You might also consider" ranking. */
  proOfferedRecords?: ServiceRecordForAI[];
}

interface BestMatchOut {
  serviceName: string | null;
  categoryName: string | null;
  serviceSlug: string | null;
  categorySlug: string | null;
  subcategory: string | null;
}

/** Fallback catalog if client sends no serviceRecords (slug + meta for routing). */
const FALLBACK_SERVICES: { en: string; fr: string; slug: string; categorySlug: string; categoryName: string }[] = [
  { en: "Kitchen Remodel", fr: "Rénovation de cuisine", slug: "kitchen-remodel", categorySlug: "home-improvement", categoryName: "Home Improvement" },
  { en: "Refrigerator Repair", fr: "Réparation de réfrigérateur", slug: "refrigerator-repair", categorySlug: "home-improvement", categoryName: "Home Improvement" },
  { en: "Appliance Repair", fr: "Réparation d'électroménagers", slug: "appliance-repair", categorySlug: "home-improvement", categoryName: "Home Improvement" },
  { en: "HVAC Services", fr: "Services CVC", slug: "hvac-services", categorySlug: "home-improvement", categoryName: "Home Improvement" },
  { en: "House Cleaning", fr: "Ménage résidentiel", slug: "house-cleaning", categorySlug: "cleaning", categoryName: "Cleaning" },
];

function meanPool2D(rows: number[][]): number[] {
  if (rows.length === 0) return [];
  const dim = rows[0].length;
  const out = new Array(dim).fill(0);
  for (const row of rows) {
    for (let i = 0; i < dim; i++) out[i] += row[i] ?? 0;
  }
  const n = rows.length;
  return out.map((x) => x / n);
}

/** Turn HF feature-extraction output into one 384-d vector. */
function flattenEmbedding(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length === 0) return null;
  // Flat vector
  if (Array.isArray(raw) && typeof raw[0] === "number") return raw as number[];
  // [seq, dim]
  if (Array.isArray(raw) && Array.isArray(raw[0]) && typeof (raw[0] as number[])[0] === "number") {
    return meanPool2D(raw as number[][]);
  }
  // [1, seq, dim] or nested batch
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const inner = raw[0];
    if (Array.isArray(inner) && typeof inner[0] === "number") return meanPool2D(inner as number[][]);
    if (Array.isArray(inner) && Array.isArray(inner[0])) return meanPool2D(inner as number[][]);
  }
  return null;
}

/** Router / legacy wrappers sometimes nest the tensor array. */
function unwrapInferenceJson(data: unknown): unknown {
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.embeddings)) return o.embeddings;
    if (Array.isArray(o.data)) return o.data;
  }
  return data;
}

/** Batch API: one tensor per input, or stacked — normalize to N vectors. */
function parseBatchEmbeddings(data: unknown, n: number): number[][] | null {
  if (!Array.isArray(data)) return null;
  if (data.length === n) {
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
      const v = flattenEmbedding(data[i]);
      if (!v) return null;
      out.push(v);
    }
    return out;
  }
  // Single stacked response for batch — try one pooled vector per slice
  if (n === 1) {
    const v = flattenEmbedding(data);
    return v ? [v] : null;
  }
  return null;
}

async function geminiEmbed(googleKey: string, inputs: string | string[]): Promise<number[][]> {
  const arr = Array.isArray(inputs) ? inputs : [inputs];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBED_MODEL)}:batchEmbedContents?key=${encodeURIComponent(googleKey)}`;
  const requests = arr.map((text) => ({
    model: `models/${GEMINI_EMBED_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: GEMINI_EMBED_DIM,
    taskType: "SEMANTIC_SIMILARITY",
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini embed ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
  const out: number[][] = [];
  for (const emb of data.embeddings ?? []) {
    if (!emb.values?.length) throw new Error("Could not parse Gemini embedding");
    out.push(emb.values);
  }
  if (out.length !== arr.length) throw new Error(`Gemini embed count mismatch ${out.length} vs ${arr.length}`);
  return out;
}

function isQuotaOrUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|403|quota|rate.?limit|RESOURCE_EXHAUSTED|unavailable)\b/i.test(msg);
}

/**
 * Prefer Gemini when configured; on quota/errors fall back to Hugging Face.
 * Returns provider so catalog cache stays dimension-compatible (768 vs 384).
 */
async function embedTexts(
  opts: { googleKey?: string; hfKey?: string },
  inputs: string | string[],
  forceProvider?: "gemini" | "hf",
): Promise<{ vecs: number[][]; provider: "gemini" | "hf" }> {
  const wantGemini = forceProvider !== "hf" && Boolean(opts.googleKey);
  const wantHf = forceProvider !== "gemini" && Boolean(opts.hfKey);

  if (wantGemini && opts.googleKey) {
    try {
      return { vecs: await geminiEmbed(opts.googleKey, inputs), provider: "gemini" };
    } catch (err) {
      if (!wantHf || !opts.hfKey) throw err;
      console.warn("search-suggestions: Gemini failed, falling back to HF:", err instanceof Error ? err.message : err);
    }
  }

  if (wantHf && opts.hfKey) {
    return { vecs: await hfEmbed(opts.hfKey, inputs), provider: "hf" };
  }

  throw new Error("No embedding provider configured");
}

async function hfEmbed(
  hfKey: string,
  inputs: string | string[]
): Promise<number[][]> {
  const res = await fetch(HF_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HF embed ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = unwrapInferenceJson(await res.json());
  const arr = Array.isArray(inputs) ? inputs : [inputs];
  const n = arr.length;
  let vecs = parseBatchEmbeddings(data, n);
  if (!vecs && n === 1) {
    const v = flattenEmbedding(data);
    if (v) vecs = [v];
  }
  if (!vecs || vecs.length !== n) {
    // Last resort: sequential single calls (rare shape mismatch)
    const single: number[][] = [];
    for (const text of arr) {
      const r = await fetch(HF_EMBED_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = unwrapInferenceJson(await r.json());
      const v = flattenEmbedding(d);
      if (!v) throw new Error("Could not parse embedding");
      single.push(v);
    }
    return single;
  }
  return vecs;
}

function l2normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const m = Math.sqrt(s) || 1;
  return v.map((x) => x / m);
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Hybrid: MiniLM can confuse short queries (e.g. "phone" vs "house"); nudge by intent. */
/** Extra nudge when query words overlap known aliases (lightweight; embeddings still primary). */
function aliasBoost(query: string, record: ServiceRecordForAI): number {
  const q = query.toLowerCase();
  let bonus = 0;
  if (/\b(roof|toiture|shingle|gutter|attic|leak)\b/i.test(q) && /roof/i.test(record.slug)) bonus += 0.18;
  if (/\b(deck|patio|terrasse|backyard|balcony)\b/i.test(q) && /deck|patio/i.test(record.slug)) bonus += 0.18;
  if (/\b(fridge|freezer|réfrig|doesn'?t cool|not cooling|broken fridge)\b/i.test(q) && /refrigerator|appliance/i.test(record.slug)) bonus += 0.15;
  if (
    /\b(faucet|tap|sink|plumb|toilet|drain|pipe|robinet|évier|plomberie|fuite|toilette)\b/i.test(q) &&
    /plumb|faucet|drain|pipe|toilet|sink/i.test(`${record.slug} ${record.embedText} ${record.name}`)
  ) {
    bonus += 0.22;
  }
  if (/\b(leak|fuite|leaking)\b/i.test(q) && /plumb|roof|pipe|faucet|drain/i.test(`${record.slug} ${record.embedText}`)) {
    bonus += 0.1;
  }
  return bonus;
}

function keywordBoost(query: string, record: ServiceRecordForAI): number {
  const techOrMobile =
    /\b(phone|iphone|android|mobile|smartphone|tablet|laptop|computer|pc|macbook|wifi|router|network|internet|software|virus|email|printer|monitor|screen|help\s*desk|device)\b/i.test(
      query
    ) ||
    /\b(tech|it)\b/i.test(query) ||
    /\b(téléphone|mobile|ordinateur|informatique|wifi|logiciel)\b/i.test(query);

  let bonus = 0;

  if (techOrMobile) {
    if (record.slug === "it-support") bonus += 0.42;
    if (record.slug === "web-development") bonus += 0.12;
  }

  if (/\brepair\b/i.test(query)) {
    if (record.categorySlug === "cleaning" && !/\b(clean|maid|house|deep|move|ménage|nettoyage)\b/i.test(query)) {
      bonus -= 0.22;
    }
    if (record.slug === "it-support" && techOrMobile) bonus += 0.08;
    if (
      record.slug === "appliance-repair" &&
      /\b(fridge|refrigerator|washer|dryer|oven|dishwasher|microwave|appliance|électroménager)\b/i.test(query)
    ) {
      bonus += 0.28;
    }
  }

  return bonus;
}

interface CachedCatalog {
  hash: string;
  records: ServiceRecordForAI[];
  vectors: number[][];
  provider: "gemini" | "hf";
}

let catalogCache: CachedCatalog | null = null;
let proOfferCache: CachedCatalog | null = null;

function hashCatalog(records: ServiceRecordForAI[]): string {
  return records.map((r) => `${r.slug}|${r.embedText}`).join("¦");
}

function sanitizeProRecords(raw: ServiceRecordForAI[] | undefined): ServiceRecordForAI[] {
  if (!raw?.length) return [];
  const out: ServiceRecordForAI[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const slug = (r.slug ?? "").trim();
    const cat = (r.categorySlug ?? "").trim();
    if (!slug || !cat) continue;
    const name = (r.name ?? "").trim() || slug;
    const dedupe = `${cat}|${slug}|${name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      name,
      slug,
      categoryName: (r.categoryName ?? "").trim() || cat,
      categorySlug: cat,
      subcategory: (r.subcategory ?? "").trim(),
      embedText: (r.embedText ?? "").trim() || `${name} | ${name}`,
    });
    if (out.length >= 500) break;
  }
  return out;
}

function recordsFromBody(serviceRecords: ServiceRecordForAI[] | undefined): ServiceRecordForAI[] {
  if (serviceRecords?.length) {
    return serviceRecords.map((r) => ({
      name: r.name,
      slug: r.slug,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      subcategory: r.subcategory || "",
      embedText: r.embedText || `${r.name} | ${r.name}`,
    }));
  }
  return FALLBACK_SERVICES.map((s) => ({
    name: s.en,
    slug: s.slug,
    categoryName: s.categoryName,
    categorySlug: s.categorySlug,
    subcategory: "",
    embedText: `${s.en} | ${s.fr}`,
  }));
}

function lexicalOverlap(query: string, record: ServiceRecordForAI): number {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .filter((t) => t.length >= 3);
  if (!tokens.length) return 0;
  const hay = `${record.name} ${record.embedText} ${record.slug} ${record.categoryName}`.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

/** No-API fallback when Gemini quota is exhausted and HF is unavailable. */
function lexicalTopMatches(query: string, records: ServiceRecordForAI[], topK: number) {
  const scored = records.map((rec, index) => {
    const cosine = 0;
    const score =
      keywordBoost(query, rec) + aliasBoost(query, rec) + lexicalOverlap(query, rec) * 0.45;
    return { index, score, cosine };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((r) => r.score > 0).slice(0, topK);
}

/** Warm cache: batch embed all service strings. */
async function ensureCatalogEmbeddings(
  keys: { googleKey?: string; hfKey?: string },
  records: ServiceRecordForAI[],
  forceProvider?: "gemini" | "hf",
): Promise<"gemini" | "hf" | null> {
  const preferred: "gemini" | "hf" | null = forceProvider
    ?? (keys.googleKey ? "gemini" : keys.hfKey ? "hf" : null);
  if (!preferred) return null;

  const tryProviders: Array<"gemini" | "hf"> =
    preferred === "gemini" && keys.hfKey ? ["gemini", "hf"] : preferred === "hf" ? ["hf"] : keys.googleKey ? ["gemini"] : [];

  let lastErr: unknown = null;
  for (const provider of tryProviders) {
    if (provider === "gemini" && !keys.googleKey) continue;
    if (provider === "hf" && !keys.hfKey) continue;
    const h = `${provider}:${hashCatalog(records)}`;
    if (
      catalogCache &&
      catalogCache.hash === h &&
      catalogCache.vectors.length === records.length &&
      catalogCache.provider === provider
    ) {
      return provider;
    }
    try {
      const texts = records.map((r) => r.embedText);
      const CHUNK = 32;
      const allVecs: number[][] = [];
      for (let i = 0; i < texts.length; i += CHUNK) {
        const chunk = texts.slice(i, i + CHUNK);
        const { vecs } = await embedTexts(keys, chunk, provider);
        for (const v of vecs) allVecs.push(l2normalize(v));
      }
      catalogCache = { hash: h, records, vectors: allVecs, provider };
      return provider;
    } catch (err) {
      lastErr = err;
      console.warn(`search-suggestions: catalog embed via ${provider} failed:`, err instanceof Error ? err.message : err);
      if (provider === "gemini" && isQuotaOrUnavailable(err)) continue;
      if (provider === "gemini") continue;
    }
  }
  if (lastErr) console.error("search-suggestions: all catalog embedding providers failed", lastErr);
  return null;
}

async function ensureProOfferEmbeddings(
  keys: { googleKey?: string; hfKey?: string },
  records: ServiceRecordForAI[],
  forceProvider?: "gemini" | "hf",
): Promise<void> {
  if (records.length === 0) {
    proOfferCache = null;
    return;
  }
  const provider = forceProvider ?? (keys.googleKey ? "gemini" : "hf");
  if ((provider === "gemini" && !keys.googleKey) || (provider === "hf" && !keys.hfKey)) {
    proOfferCache = null;
    return;
  }
  const h = `pro:${provider}:${hashCatalog(records)}`;
  if (proOfferCache && proOfferCache.hash === h && proOfferCache.vectors.length === records.length && proOfferCache.provider === provider) {
    return;
  }
  try {
    const texts = records.map((r) => r.embedText);
    const CHUNK = 32;
    const allVecs: number[][] = [];
    for (let i = 0; i < texts.length; i += CHUNK) {
      const chunk = texts.slice(i, i + CHUNK);
      const { vecs } = await embedTexts(keys, chunk, provider);
      for (const v of vecs) allVecs.push(l2normalize(v));
    }
    proOfferCache = { hash: h, records, vectors: allVecs, provider };
  } catch (err) {
    console.warn("search-suggestions: pro-offer embeddings failed:", err instanceof Error ? err.message : err);
    proOfferCache = null;
  }
}

function topMatches(
  query: string,
  queryVec: number[],
  records: ServiceRecordForAI[],
  vectors: number[][],
  topK: number
): { index: number; score: number; cosine: number }[] {
  const q = l2normalize(queryVec);
  const scored = records.map((_, i) => {
    const cosine = cosineSim(q, vectors[i] ?? []);
    return {
      index: i,
      score: cosine + keywordBoost(query, records[i]!) + aliasBoost(query, records[i]!),
      cosine,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (query.length < 2) {
      return jsonResponse({
        suggestions: [],
        summary: null,
        followUpQuestions: [],
        clarifyingMessage: null,
        bestMatch: null,
        topThree: [],
        topFour: [],
        followUpMatches: [],
      });
    }

    const googleKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY")?.trim() || "";
    const hfKey = Deno.env.get("HUGGINGFACE_API_KEY")?.trim() || "";
    // Embedding keys preferred; lexical ranking still works without them.

    const keys = { googleKey: googleKey || undefined, hfKey: hfKey || undefined };

    const catalogRecords = recordsFromBody(body.serviceRecords);
    let provider = googleKey || hfKey ? await ensureCatalogEmbeddings(keys, catalogRecords) : null;

    let top: { index: number; score: number; cosine: number }[] = [];
    let usedEmbedding = false;
    let queryVec: number[] | null = null;

    if (provider && catalogCache && catalogCache.vectors.length === catalogRecords.length) {
      try {
        const embedded = await embedTexts(keys, query, provider);
        if (embedded.provider !== provider) {
          provider = await ensureCatalogEmbeddings(keys, catalogRecords, embedded.provider);
        }
        if (provider && catalogCache && catalogCache.provider === provider) {
          queryVec = l2normalize(embedded.vecs[0]!);
          top = topMatches(query, queryVec, catalogRecords, catalogCache.vectors, 12);
          usedEmbedding = true;
        }
      } catch (err) {
        console.warn(
          "search-suggestions: query embed failed, trying HF/lexical:",
          err instanceof Error ? err.message : err,
        );
        if (provider === "gemini" && keys.hfKey) {
          try {
            provider = await ensureCatalogEmbeddings(keys, catalogRecords, "hf");
            if (provider === "hf" && catalogCache) {
              const embedded = await embedTexts(keys, query, "hf");
              queryVec = l2normalize(embedded.vecs[0]!);
              top = topMatches(query, queryVec, catalogRecords, catalogCache.vectors, 12);
              usedEmbedding = true;
            }
          } catch (err2) {
            console.warn(
              "search-suggestions: HF fallback failed:",
              err2 instanceof Error ? err2.message : err2,
            );
          }
        }
      }
    }

    if (!top.length) {
      top = lexicalTopMatches(query, catalogRecords, 12);
      usedEmbedding = false;
      queryVec = null;
    }

    if (!top.length || !catalogRecords[top[0]!.index]) {
      return jsonResponse({
        suggestions: [],
        summary: null,
        followUpQuestions: [],
        clarifyingMessage: null,
        bestMatch: null,
        topThree: [],
        topFour: [],
        followUpMatches: [],
        error: "No matching services for that query",
      });
    }

    const bestIdx = top[0]!.index;
    const best = catalogRecords[bestIdx]!;
    const bestScore = top[0]!.cosine || top[0]!.score;

    /** Ranked names — legacy chips (hero may ignore in favor of best + 3 follow-ups). */
    const suggestionNames = top
      .map((t) => catalogRecords[t.index]?.name)
      .filter((n): n is string => !!n)
      .filter((n, i, a) => a.indexOf(n) === i)
      .slice(0, 6);

    /** Vector + keyword/alias hybrid: 1 best + 3 follow-up distinct services (classification, not chat). */
    type MatchRow = {
      serviceName: string;
      serviceSlug: string;
      categorySlug: string;
      categoryName: string;
      score: number;
      cosine: number;
    };
    const topFour: MatchRow[] = [];
    const seenSlugsFour = new Set<string>();
    for (const row of top) {
      const rec = catalogRecords[row.index];
      if (!rec || seenSlugsFour.has(rec.slug)) continue;
      seenSlugsFour.add(rec.slug);
      topFour.push({
        serviceName: rec.name,
        serviceSlug: rec.slug,
        categorySlug: rec.categorySlug,
        categoryName: rec.categoryName,
        score: row.score,
        cosine: row.cosine,
      });
      if (topFour.length >= 4) break;
    }

    /** Back-compat: first 3 distinct matches. */
    const topThree = topFour.slice(0, 3);

    const proRecords = sanitizeProRecords(body.proOfferedRecords);
    let followUpMatches: MatchRow[] = [];
    const bestNameLower = (best.name ?? "").trim().toLowerCase();

    if (usedEmbedding && queryVec && proRecords.length > 0 && provider) {
      await ensureProOfferEmbeddings(keys, proRecords, provider);
      if (proOfferCache && proOfferCache.vectors.length === proRecords.length) {
        const proTop = topMatches(query, queryVec, proRecords, proOfferCache.vectors, 24);
        const seen = new Set<string>();
        for (const row of proTop) {
          const rec = proRecords[row.index];
          if (!rec) continue;
          const labelLower = rec.name.trim().toLowerCase();
          if (labelLower === bestNameLower) continue;
          const dedupeKey = `${rec.slug}::${labelLower}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          followUpMatches.push({
            serviceName: rec.name,
            serviceSlug: rec.slug,
            categorySlug: rec.categorySlug,
            categoryName: rec.categoryName,
            score: row.score,
            cosine: row.cosine,
          });
          if (followUpMatches.length >= 3) break;
        }
      }
    }

    if (followUpMatches.length < 3) {
      const catalogFollow = topFour.slice(1, 4);
      for (const c of catalogFollow) {
        if (followUpMatches.length >= 3) break;
        if (c.serviceName.trim().toLowerCase() === bestNameLower) continue;
        const dup = followUpMatches.some(
          (f) => f.serviceSlug === c.serviceSlug && f.serviceName.trim().toLowerCase() === c.serviceName.trim().toLowerCase()
        );
        if (dup) continue;
        followUpMatches.push(c);
      }
    }

    const bestMatch: BestMatchOut = {
      serviceName: best.name,
      categoryName: best.categoryName,
      serviceSlug: best.slug,
      categorySlug: best.categorySlug,
      subcategory: best.subcategory || null,
    };

    return jsonResponse({
      summary: null,
      suggestions: suggestionNames,
      followUpQuestions: [],
      clarifyingMessage: null,
      bestMatch,
      topThree,
      topFour,
      followUpMatches,
      confidence: bestScore,
      _embedding: usedEmbedding,
      _provider: usedEmbedding ? provider : "lexical",
    });
  } catch (error) {
    console.error("search-suggestions:", error);
    return jsonResponse(
      {
        error: "Suggestions temporarily unavailable. Please refresh or contact support.",
        suggestions: [],
        summary: null,
        followUpQuestions: [],
        clarifyingMessage: null,
        bestMatch: null,
        topThree: [],
        topFour: [],
        followUpMatches: [],
      },
      500
    );
  }
});

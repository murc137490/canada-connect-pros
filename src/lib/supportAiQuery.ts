/** Shared helpers: Support page + hero search (classify services, not conversational AI). */

export type ServiceMatchItem = {
  serviceName: string;
  serviceSlug: string;
  categorySlug: string;
  categoryName: string;
  score?: number;
  cosine?: number;
};

/** @deprecated use ServiceMatchItem */
export type TopThreeItem = ServiceMatchItem;

/** Trim, single-line friendly spacing, drop odd control chars. */
export function cleanSupportQuery(raw: string): string {
  let q = raw.trim().replace(/\s+/g, " ");
  q = q.replace(/[\u0000-\u001F\u007F]/g, "");
  return q.slice(0, 2000);
}

const FR_HINT =
  /\b(le|la|les|des|un|une|pour|avec|dans|sur|vous|nous|être|est|sont|mon|ma|mes|besoin|aide|comment|où|quand|pourquoi)\b/i;
const FR_CHARS = /[àâäéèêëïîôùûçœæ]/i;

/** Lightweight detection before server / embedding (UI language for labels). */
export function detectLanguageFromUserInput(text: string): "en" | "fr" {
  const t = text.trim();
  if (!t) return "en";
  let frScore = 0;
  if (FR_CHARS.test(t)) frScore += 2;
  if (FR_HINT.test(t)) frScore += 1;
  const words = t.split(/\s+/).length;
  const frWordHits = (t.match(/\b(le|la|les|des|une|pour|avec|comment|besoin|maison|réparation)\b/gi) ?? []).length;
  frScore += Math.min(3, frWordHits * 0.5);
  return frScore >= 2 || (words <= 8 && frScore >= 1.5) ? "fr" : "en";
}

/**
 * Reply language for Support AI: inferred from all user prompts in the thread plus the
 * current message (majority vote per user turn). Tie → detection on combined text.
 */
export function inferSupportReplyLanguage(
  priorMessages: { role: string; content?: string }[],
  currentUserText: string
): "en" | "fr" {
  const chunks = priorMessages
    .filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim())
    .map((m) => m.content!.trim());
  const cur = currentUserText.trim();
  if (cur) chunks.push(cur);
  if (chunks.length === 0) return "en";

  let fr = 0;
  let en = 0;
  for (const c of chunks) {
    if (detectLanguageFromUserInput(c) === "fr") fr += 1;
    else en += 1;
  }
  if (fr > en) return "fr";
  if (en > fr) return "en";
  return detectLanguageFromUserInput(chunks.join("\n"));
}

/** Route to HF support chatbot (FAQ / account / billing) instead of service vector search. */
export function isMetaSupportQuery(cleaned: string): boolean {
  const q = cleaned.toLowerCase();
  if (cleaned.length < 3) return false;

  const platform =
    /\b(password|mot de passe|email|courriel|account|compte|billing|facture|payment|paiement|refund|remboursement|cancel|annul|subscription|abonnement|plan|forfait|stripe|square|charge|frais|fee|contact support|how do i|comment puis|where can|où puis)\b/i.test(
      q
    );

  const premiere =
    /\b(premiere services|première services|customer service|service client|help desk|faq|terms|conditions|privacy|confidentialité)\b/i.test(
      q
    );

  const metaPhrase =
    /^(how (much|does)|combien|what is your|quel est votre|do you offer|offrez-vous)/i.test(cleaned.trim());

  return platform || premiere || metaPhrase;
}

import { CANADIAN_LANGUAGES, type LanguageLevel } from "@/i18n/constants";

export type ParsedLanguageEntry = {
  /** Display name in current locale when resolvable */
  languageLabel: string;
  /** best-effort level key for i18n */
  level: LanguageLevel | null;
  /** original segment for fallback bubble */
  raw: string;
};

const BLOCK_RE = /\n\n(?:Languages|Langues)\s*:\s*([\s\S]+)$/i;

function normalizeLevel(text: string): LanguageLevel | null {
  const t = text.trim().toLowerCase();
  if (/\bfluent\b|\bcourant\b|\bfluid\b/i.test(t)) return "fluent";
  if (/\bconversational\b|\bconversationnel\b|\bintermediate\b|\bmoyen\b/i.test(t)) return "conversational";
  if (/\bbasic\b|\bde base\b|\bbeginner\b|\bdébutant\b/i.test(t)) return "basic";
  return null;
}

/** Match stored language name to CANADIAN_LANGUAGES for localized label. */
function resolveLanguageLabel(nameFromBio: string, locale: "en" | "fr"): string {
  const n = nameFromBio.trim().toLowerCase();
  for (const L of CANADIAN_LANGUAGES) {
    if (L.nameEn.toLowerCase() === n || L.nameFr.toLowerCase() === n) {
      return locale === "fr" ? L.nameFr : L.nameEn;
    }
  }
  return nameFromBio.trim();
}

/**
 * Splits pro bio into main text and language entries appended by Create Pro (`Languages: …`).
 */
export function splitBioAndLanguages(bio: string | null | undefined, locale: "en" | "fr"): {
  mainBio: string;
  entries: ParsedLanguageEntry[];
} {
  if (!bio?.trim()) return { mainBio: "", entries: [] };
  const full = bio.replace(/\r\n/g, "\n");
  const m = full.match(BLOCK_RE);
  if (!m || m.index == null) return { mainBio: full.trim(), entries: [] };

  const mainBio = full.slice(0, m.index).trim();
  const rest = m[1].trim();
  const entries: ParsedLanguageEntry[] = [];

  const segments = rest.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const inner = seg.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (inner) {
      const namePart = inner[1].trim();
      const levelPart = inner[2].trim();
      entries.push({
        languageLabel: resolveLanguageLabel(namePart, locale),
        level: normalizeLevel(levelPart),
        raw: seg,
      });
    } else {
      entries.push({ languageLabel: seg, level: null, raw: seg });
    }
  }

  return { mainBio, entries };
}

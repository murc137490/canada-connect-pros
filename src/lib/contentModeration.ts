/** Basic blocklist for admin display / client submit guard (not exhaustive legal review). */
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(cocaine|heroin|meth|fentanyl|weed delivery|marijuana sale)\b/i,
  /\b(escort|prostitut|sexual service|onlyfans|nude)\b/i,
  /\b(hitman|assassin|kill someone|stalk someone)\b/i,
  /\b(fake id|counterfeit|money laundering)\b/i,
  /\b(untraceable gun|buy gun no license)\b/i,
];

export function isContentBlocked(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return BLOCKED_PATTERNS.some((re) => re.test(t));
}

export function contentUnavailableLabel(locale: "en" | "fr"): string {
  return locale === "fr" ? "Contenu non disponible" : "Content unavailable";
}

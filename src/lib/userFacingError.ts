/**
 * Client-safe error presentation.
 * Never surface Postgres/JWT/stack/edge internals to users or toast text.
 */

import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/config/legalConfig";

const TECH_ERROR_RE =
  /\b(PGRST|JWT|RLS|postgres|supabase|edge function|stack|TypeError|ReferenceError|SyntaxError|ECONN|ENOTFOUND|fetch failed|Failed to fetch|networkerror|cors|401|403|406|429|500|502|503|status code|schema cache|permission denied|violates|constraint|relation \"|column \"|undefined is not|is not a function|Cannot read propert|Unexpected token|huggingface|gemini|quota|RESOURCE_EXHAUSTED|apikey|service_role|anon key)\b/i;

const LOOKS_LIKE_STACK_RE = /^\s*at\s+\S+/m;
const LOOKS_LIKE_JSON_ERR_RE = /^\s*\{[\s\S]*"error"\s*:/;

export function readUiLocale(): "en" | "fr" {
  try {
    const stored = localStorage.getItem("premiere-locale");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr")) return "fr";
  } catch {
    /* ignore */
  }
  return "en";
}

export const SAFE_USER_ERROR = {
  en: {
    title: "Something went wrong",
    description: `Please refresh the page. If it continues, contact support at ${SUPPORT_EMAIL} or visit the Support page.`,
    short: "Please refresh or contact support.",
    supportCta: "Go to Support",
  },
  fr: {
    title: "Une erreur est survenue",
    description: `Veuillez actualiser la page. Si le problème continue, contactez le soutien à ${SUPPORT_EMAIL} ou ouvrez la page Aide.`,
    short: "Actualisez la page ou contactez le soutien.",
    supportCta: "Aller à l’aide",
  },
} as const;

/** True when a string looks like an internal/technical failure (unsafe to show). */
export function looksLikeTechnicalError(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw !== "string") {
    if (raw instanceof Error) return looksLikeTechnicalError(raw.message);
    try {
      return looksLikeTechnicalError(String(raw));
    } catch {
      return true;
    }
  }
  const s = raw.trim();
  if (!s) return false;
  if (s.length > 220) return true;
  if (LOOKS_LIKE_STACK_RE.test(s) || LOOKS_LIKE_JSON_ERR_RE.test(s)) return true;
  if (TECH_ERROR_RE.test(s)) return true;
  if (/https?:\/\/\S+\.supabase\.co/i.test(s)) return true;
  if (/\/rest\/v1\//i.test(s) || /\/functions\/v1\//i.test(s)) return true;
  return false;
}

/** Always returns a human-safe message (never internal codes). */
export function toUserFacingMessage(raw: unknown, locale?: "en" | "fr"): string {
  const loc = locale ?? readUiLocale();
  const copy = SAFE_USER_ERROR[loc];
  if (raw == null || raw === "") return copy.description;
  if (typeof raw === "string" && !looksLikeTechnicalError(raw) && raw.length <= 180) {
    return raw;
  }
  if (raw instanceof Error && !looksLikeTechnicalError(raw.message) && raw.message.length <= 180) {
    return raw.message;
  }
  return copy.description;
}

export function toUserFacingTitle(locale?: "en" | "fr"): string {
  return SAFE_USER_ERROR[locale ?? readUiLocale()].title;
}

/**
 * Sanitize toast fields before display.
 * Keeps intentional short UX copy; replaces technical dumps.
 */
export function sanitizeToastContent(input: {
  title?: ReactNode;
  description?: ReactNode;
  variant?: string;
}): { title?: ReactNode; description?: ReactNode } {
  const locale = readUiLocale();
  const copy = SAFE_USER_ERROR[locale];

  const titleStr = typeof input.title === "string" ? input.title : null;
  const descStr = typeof input.description === "string" ? input.description : null;

  let title = input.title;
  let description = input.description;

  if (titleStr && looksLikeTechnicalError(titleStr)) {
    title = copy.title;
  }
  if (descStr && looksLikeTechnicalError(descStr)) {
    description = copy.description;
  }
  if (
    input.variant === "destructive" &&
    (description == null || description === "") &&
    (titleStr === "Error" || titleStr === "Erreur" || !titleStr)
  ) {
    title = copy.title;
    description = copy.description;
  }

  return { title, description };
}

/** Dev-only sink; never logs in production builds. */
export function logClientDiagnostic(scope: string, err?: unknown): void {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.warn(`[premiere:${scope}]`, err);
}

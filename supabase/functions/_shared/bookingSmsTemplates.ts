/**
 * Pro-tier SMS copy (EN + FR) + mandatory support footer.
 * Pros may customize the client body; support contact + STOP line are always appended.
 */

export type SmsLang = "en" | "fr";
export type SmsEvent = "request" | "confirmation" | "reminder" | "review_request";

export const SMS_SUPPORT_FOOTER: Record<SmsLang, string> = {
  en: "AltShift support: +1 450 800 3177 · support@altshift.ca. Reply STOP to opt out.",
  fr: "Soutien AltShift : +1 450 800 3177 · support@altshift.ca. Répondez STOP pour vous désabonner.",
};

export type SmsTemplateVars = {
  businessName: string;
  clientName?: string;
  datePart: string;
  timePart: string;
  reviewUrl?: string;
};

export function smsLang(raw: unknown): SmsLang {
  return typeof raw === "string" && raw.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** "2026-10-09" -> "Fri, Oct 9" / "ven. 9 oct." (date only, no TZ shift). */
export function formatSmsDate(ymd: string, lang: SmsLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  try {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${ymd}T12:00:00Z`));
  } catch {
    return ymd;
  }
}

function whenPart(lang: SmsLang, datePart: string, timePart: string): string {
  if (lang === "fr") return `${datePart ? ` le ${datePart}` : ""}${timePart ? ` à ${timePart.replace(":", " h ")}` : ""}`;
  return `${datePart ? ` on ${datePart}` : ""}${timePart ? ` at ${timePart}` : ""}`;
}

export function defaultSmsBody(event: SmsEvent, vars: SmsTemplateVars, forRole: "client" | "pro", lang: SmsLang): string {
  const fr = lang === "fr";
  const biz = vars.businessName || (fr ? "votre professionnel" : "your professional");
  const client = vars.clientName || (fr ? "votre client" : "your client");
  const when = whenPart(lang, vars.datePart, vars.timePart);
  const link = vars.reviewUrl || "https://www.altshift.ca/dashboard";
  if (event === "request") {
    if (forRole === "pro") {
      return fr
        ? `AltShift : nouvelle demande de réservation de ${client}${when}. Acceptez-la ou refusez-la dans votre tableau de bord : ${link}`
        : `AltShift: new booking request from ${client}${when}. Accept or decline it in your dashboard: ${link}`;
    }
    return fr
      ? `AltShift : votre demande de réservation avec ${biz}${when} a été envoyée. Nous vous écrirons dès qu'elle sera acceptée.`
      : `AltShift: your booking request with ${biz}${when} was sent. We'll text you as soon as it's accepted.`;
  }
  if (event === "confirmation") {
    if (forRole === "pro") return fr ? `AltShift : réservation confirmée avec ${client}${when}.` : `AltShift: booking confirmed with ${client}${when}.`;
    return fr
      ? `AltShift : réservation confirmée avec ${biz}${when}. Si c'est en soirée, laissez l'éclairage extérieur allumé.`
      : `AltShift: booking confirmed with ${biz}${when}. If it's in the evening, please leave outdoor lights on.`;
  }
  if (event === "reminder") {
    if (forRole === "pro") return fr ? `Rappel AltShift : travail avec ${client}${when}.` : `AltShift reminder: job with ${client}${when}.`;
    return fr
      ? `Rappel AltShift : rendez-vous avec ${biz}${when}. Si c'est en soirée, laissez l'éclairage extérieur allumé.`
      : `AltShift reminder: appointment with ${biz}${when}. If it's in the evening, please leave outdoor lights on.`;
  }
  // review_request (client only)
  return fr
    ? `Comment s'est passé votre service avec ${biz}? Laissez un avis rapide : ${link}`
    : `How did your service with ${biz} go? Leave a quick review: ${link}`;
}

/** Final SMS: custom body (if any) or default, then always the support + STOP footer. */
export function buildSmsText(opts: {
  event: SmsEvent;
  forRole: "client" | "pro";
  customBody?: string | null;
  vars: SmsTemplateVars;
  lang?: SmsLang;
}): string {
  const lang = opts.lang ?? "en";
  const custom = (opts.customBody ?? "").trim();
  const body = custom || defaultSmsBody(opts.event, opts.vars, opts.forRole, lang);
  const cleaned = body
    .replace(/\s*Reply STOP to opt out\.?/gi, "")
    .replace(/\s*Répondez STOP[^.]*\.?/gi, "")
    .trim();
  return `${cleaned} ${SMS_SUPPORT_FOOTER[lang]}`;
}

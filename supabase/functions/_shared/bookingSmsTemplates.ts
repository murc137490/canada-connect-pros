/**
 * Default Pro-tier SMS copy + mandatory support footer.
 * Pros may customize the body; support contact is always appended.
 */

export const SMS_SUPPORT_FOOTER =
  "Support: +1 450 800 3177 · support@altshift.ca · https://www.altshift.ca (chat). Reply STOP to opt out.";

export type SmsEvent = "confirmation" | "reminder" | "review_request";

export type SmsTemplateVars = {
  businessName: string;
  clientName?: string;
  datePart: string;
  timePart: string;
  reviewUrl?: string;
};

function whenPart(datePart: string, timePart: string): string {
  return `${datePart ? ` on ${datePart}` : ""}${timePart ? ` at ${timePart}` : ""}`;
}

export function defaultSmsBody(event: SmsEvent, vars: SmsTemplateVars, forRole: "client" | "pro"): string {
  const biz = vars.businessName || "your professional";
  const client = vars.clientName || "your client";
  const when = whenPart(vars.datePart, vars.timePart);
  if (event === "confirmation") {
    if (forRole === "pro") return `New booking with ${client}${when}.`;
    return `Booking confirmed with ${biz}${when}. If your appointment is late evening, please leave outdoor lights on for safety.`;
  }
  if (event === "reminder") {
    if (forRole === "pro") return `Reminder: job with ${client}${when}.`;
    return `Reminder: appointment with ${biz}${when}. If it is late at night, please keep outdoor lights on for the professional.`;
  }
  // review_request — client only
  const link = vars.reviewUrl || "https://www.altshift.ca/dashboard";
  return `How did you like your service with ${biz}? Leave a quick review: ${link}`;
}

/** Build final SMS: custom body (if any) or default, then always support footer. */
export function buildSmsText(opts: {
  event: SmsEvent;
  forRole: "client" | "pro";
  customBody?: string | null;
  vars: SmsTemplateVars;
}): string {
  const custom = (opts.customBody ?? "").trim();
  const body = custom || defaultSmsBody(opts.event, opts.vars, opts.forRole);
  // Strip accidental STOP lines from custom; we append our own footer.
  const cleaned = body.replace(/\s*Reply STOP to opt out\.?/gi, "").trim();
  if (/support@altshift\.ca|\+1\s*450\s*800\s*3177|altshift\.ca/i.test(cleaned)) {
    // Still ensure STOP line if missing
    if (/Reply STOP/i.test(cleaned)) return cleaned;
    return `${cleaned} Reply STOP to opt out.`;
  }
  return `${cleaned} ${SMS_SUPPORT_FOOTER}`;
}

/**
 * Premiere Services transactional email design system.
 * Brand-aligned with the web app: navy primary, warm stone background,
 * Manrope/system sans, Instrument Serif–style wordmark (Georgia fallback).
 * Email-safe: table layout, inline styles, no JS.
 */

export type EmailLanguage = "en" | "fr";

export const EMAIL_BRAND = {
  /** Site --primary ≈ hsl(222 68% 20%) */
  primary: "#102556",
  primaryForeground: "#FBF9F6",
  /** Site --background ≈ hsl(36 22% 97%) */
  pageBg: "#F8F6F3",
  /** Site --foreground ≈ hsl(222 32% 9%) */
  ink: "#141A24",
  muted: "#5E6672",
  mutedSoft: "#8A9099",
  border: "#E0DAD2",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F0EB",
  /** Site --accent maple — use sparingly */
  accent: "#E86B0C",
  support: "support@premiereservices.ca",
  fontSans:
    "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  fontSerif: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  radius: "8px",
  radiusLg: "12px",
  width: 600,
} as const;

export type EmailShellOptions = {
  language: EmailLanguage;
  preheader: string;
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  termsUrl: string;
  privacyUrl: string;
  supportEmail?: string;
  supportHours?: string;
  /** Booking emails: show cancellation policy line */
  showPolicyLinks?: boolean;
  cancellationPolicyUrl?: string;
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attr(value: string) {
  return esc(value);
}

/** Quiet wordmark — matches site “Première” heading weight, not a giant H1. */
export function emailHeader(siteUrl: string): string {
  const home = attr(siteUrl || "https://premiereservices.ca");
  return `
  <tr>
    <td style="padding:0 0 28px 0;">
      <a href="${home}" style="text-decoration:none;color:${EMAIL_BRAND.ink};">
        <span style="font-family:${EMAIL_BRAND.fontSerif};font-size:26px;line-height:1.15;font-weight:400;letter-spacing:-0.02em;color:${EMAIL_BRAND.ink};">Première</span>
        <span style="display:inline-block;margin-left:6px;font-family:${EMAIL_BRAND.fontSans};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_BRAND.muted};vertical-align:middle;">Services</span>
      </a>
      <div style="margin-top:18px;height:2px;width:36px;background-color:${EMAIL_BRAND.primary};border-radius:1px;line-height:2px;font-size:2px;">&nbsp;</div>
    </td>
  </tr>`;
}

export function emailEyebrow(text: string): string {
  if (!text.trim()) return "";
  return `<p style="margin:0 0 10px 0;font-family:${EMAIL_BRAND.fontSans};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_BRAND.muted};">${esc(text)}</p>`;
}

export function emailTitle(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:${EMAIL_BRAND.fontSans};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.025em;color:${EMAIL_BRAND.ink};">${esc(text)}</h1>`;
}

export function emailParagraph(text: string, opts?: { muted?: boolean; size?: "body" | "sm" }): string {
  const color = opts?.muted ? EMAIL_BRAND.muted : EMAIL_BRAND.ink;
  const size = opts?.size === "sm" ? "14px" : "16px";
  return `<p style="margin:0 0 16px 0;font-family:${EMAIL_BRAND.fontSans};font-size:${size};line-height:1.65;color:${color};">${esc(text)}</p>`;
}

/** Raw HTML paragraph (already escaped / trusted fragments). */
export function emailHtmlBlock(html: string): string {
  return `<div style="margin:0 0 16px 0;font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.65;color:${EMAIL_BRAND.ink};">${html}</div>`;
}

export function emailPrimaryButton(label: string, url: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
    <tr>
      <td align="left" style="border-radius:${EMAIL_BRAND.radius};background-color:${EMAIL_BRAND.primary};">
        <a href="${attr(url)}" target="_blank" style="display:inline-block;padding:14px 22px;font-family:${EMAIL_BRAND.fontSans};font-size:15px;font-weight:700;letter-spacing:-0.01em;line-height:1.2;color:${EMAIL_BRAND.primaryForeground};text-decoration:none;border-radius:${EMAIL_BRAND.radius};">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function emailSecondaryNote(text: string): string {
  return `<p style="margin:0 0 20px 0;font-family:${EMAIL_BRAND.fontSans};font-size:14px;line-height:1.6;color:${EMAIL_BRAND.muted};">${esc(text)}</p>`;
}

export function emailDetails(rows: [string, string][]): string {
  const cells = rows
    .filter(([, v]) => String(v ?? "").trim())
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_BRAND.border};font-family:${EMAIL_BRAND.fontSans};font-size:13px;font-weight:600;color:${EMAIL_BRAND.muted};width:38%;vertical-align:top;">${esc(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_BRAND.border};font-family:${EMAIL_BRAND.fontSans};font-size:14px;font-weight:500;color:${EMAIL_BRAND.ink};vertical-align:top;">${esc(value)}</td>
      </tr>`,
    )
    .join("");
  if (!cells) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;background-color:${EMAIL_BRAND.surfaceMuted};border:1px solid ${EMAIL_BRAND.border};border-radius:${EMAIL_BRAND.radiusLg};">
    <tr>
      <td style="padding:4px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
      </td>
    </tr>
  </table>`;
}

export function emailSupportBlock(language: EmailLanguage, supportEmail: string, supportHours?: string): string {
  const label = language === "fr" ? "Besoin d’aide ?" : "Need help?";
  const hours = supportHours?.trim()
    ? ` · ${esc(supportHours.trim())}`
    : "";
  return `
  <p style="margin:28px 0 0 0;font-family:${EMAIL_BRAND.fontSans};font-size:14px;line-height:1.6;color:${EMAIL_BRAND.muted};">
    ${esc(label)}
    <a href="mailto:${attr(supportEmail)}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;">${esc(supportEmail)}</a>${hours}
  </p>`;
}

export function emailFooter(opts: {
  language: EmailLanguage;
  termsUrl: string;
  privacyUrl: string;
  showPolicyLinks?: boolean;
  cancellationPolicyUrl?: string;
}): string {
  const terms = opts.language === "fr" ? "Conditions" : "Terms";
  const privacy = opts.language === "fr" ? "Confidentialité" : "Privacy";
  const policy =
    opts.showPolicyLinks && opts.cancellationPolicyUrl
      ? `<br><a href="${attr(opts.cancellationPolicyUrl)}" style="color:${EMAIL_BRAND.mutedSoft};text-decoration:underline;">${
          opts.language === "fr" ? "Annulation et replanification" : "Cancellation &amp; reschedule"
        }</a>`
      : "";

  return `
  <tr>
    <td style="padding:32px 0 0 0;border-top:1px solid ${EMAIL_BRAND.border};">
      <p style="margin:0 0 6px 0;font-family:${EMAIL_BRAND.fontSans};font-size:12px;font-weight:600;letter-spacing:0.04em;color:${EMAIL_BRAND.ink};">Premiere Services</p>
      <p style="margin:0;font-family:${EMAIL_BRAND.fontSans};font-size:12px;line-height:1.7;color:${EMAIL_BRAND.mutedSoft};">
        <a href="mailto:support@premiereservices.ca" style="color:${EMAIL_BRAND.mutedSoft};text-decoration:underline;">support@premiereservices.ca</a>
        &nbsp;·&nbsp;
        <a href="${attr(opts.termsUrl)}" style="color:${EMAIL_BRAND.mutedSoft};text-decoration:underline;">${terms}</a>
        &nbsp;·&nbsp;
        <a href="${attr(opts.privacyUrl)}" style="color:${EMAIL_BRAND.mutedSoft};text-decoration:underline;">${privacy}</a>
        ${policy}
      </p>
      <p style="margin:12px 0 0 0;font-family:${EMAIL_BRAND.fontSans};font-size:11px;line-height:1.5;color:${EMAIL_BRAND.mutedSoft};">
        ${opts.language === "fr" ? "Canada · Courriel automatisé" : "Canada · Automated message"}
      </p>
    </td>
  </tr>`;
}

/**
 * Full HTML document shell — editorial, not a heavy SaaS card.
 * Warm page background, open content column, quiet footer.
 */
export function emailShell(opts: EmailShellOptions & { siteUrl: string }): string {
  const supportEmail = opts.supportEmail ?? EMAIL_BRAND.support;
  const eyebrow = opts.eyebrow ? emailEyebrow(opts.eyebrow) : "";

  return `<!DOCTYPE html>
<html lang="${opts.language === "fr" ? "fr" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Premiere Services</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Manrope:wght@400;500;600;700&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { color: ${EMAIL_BRAND.primary}; }
    @media only screen and (max-width: 620px) {
      .ps-shell { padding: 24px 16px !important; }
      .ps-title { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_BRAND.pageBg};opacity:0;">
    ${esc(opts.preheader)}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BRAND.pageBg};">
    <tr>
      <td align="center" class="ps-shell" style="padding:40px 24px;">
        <table role="presentation" width="${EMAIL_BRAND.width}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_BRAND.width}px;margin:0 auto;">
          ${emailHeader(opts.siteUrl)}
          <tr>
            <td style="padding:0;">
              ${eyebrow}
              <div class="ps-title">${emailTitle(opts.title)}</div>
              ${opts.bodyHtml}
              ${emailSupportBlock(opts.language, supportEmail, opts.supportHours)}
            </td>
          </tr>
          ${emailFooter({
            language: opts.language,
            termsUrl: opts.termsUrl,
            privacyUrl: opts.privacyUrl,
            showPolicyLinks: opts.showPolicyLinks,
            cancellationPolicyUrl: opts.cancellationPolicyUrl,
          })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

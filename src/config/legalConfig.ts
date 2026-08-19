/**
 * Central product/legal configuration for Première Services.
 * Not legal advice. Values marked REVIEW_REQUIRED must be confirmed by the owner / counsel.
 */

export const LEGAL_ENTITY_NAME = "REVIEW_REQUIRED — Première Services (confirm registered legal name)";

export const PRIVACY_CONTACT = {
  name: "REVIEW_REQUIRED",
  title: "Privacy contact / Responsable de la protection des renseignements personnels",
  email: "support@premiereservices.ca",
} as const;

/** Public support contact (operational). */
export const SUPPORT_EMAIL = "support@premiereservices.ca";

/**
 * What "verified" means in the product UI today.
 * Do not expand this to "licensed" or "insured" without an actual verification process.
 */
export const VERIFIED_PRO_DEFINITION = {
  en: "A verified professional has submitted an application that was reviewed and accepted by Première Services administrators (identity and, where provided, licence documents may be reviewed). Verification is not a warranty of work quality, licensing completeness, or insurance coverage.",
  fr: "Un professionnel vérifié a soumis une demande examinée et acceptée par les administrateurs de Première Services (pièce d’identité et, le cas échéant, documents de permis peuvent être examinés). La vérification n’est pas une garantie de qualité du travail, de permis complets, ni d’assurance.",
} as const;

/** Première Services platform fee shown to customers/pros (business model). */
export const PLATFORM_FEE_RATE = 0.05;

/**
 * Square Connect application fee currently applied in code (seller charges).
 * This is an implementation detail — do not present as "Square's published card rate"
 * unless verified against the live Square account.
 */
export const SQUARE_CONNECT_APP_FEE_RATE = 0.021;

/**
 * Service-resolution help (NOT a legally binding unlimited satisfaction guarantee).
 * Final customer-facing legal wording requires counsel approval.
 */
export const SERVICE_RESOLUTION_HELP = {
  enabled: true,
  /** Until counsel approves binding guarantee language, keep conservative. */
  bindingGuaranteeApproved: false,
  en: {
    title: "Booking issue help",
    short:
      "If a service booked through Première Services is not performed substantially according to the agreed booking, Première Services can help review the issue through our claims process.",
    body:
      "Possible outcomes (case-by-case, not automatic): correction/re-performance by the original professional; a replacement professional where appropriate and available; a partial refund where only part of the service was materially deficient; or a full refund in serious cases where the service was not performed or materially failed. Submitting a claim does not guarantee a refund. Première Services does not promise unlimited consequential damages or payment for all damage caused by professionals.",
  },
  fr: {
    title: "Aide en cas de problème de réservation",
    short:
      "Si un service réservé via Première Services n’est pas réalisé substantiellement conformément à la réservation convenue, Première Services peut vous aider à examiner le problème selon notre procédure de réclamation.",
    body:
      "Issues possibles (au cas par cas, non automatiques) : correction/reprise par le professionnel d’origine; un autre professionnel lorsque c’est approprié et disponible; un remboursement partiel si une partie du service était matériellement déficiente; ou un remboursement complet dans les cas graves où le service n’a pas été réalisé ou a matériellement échoué. Déposer une réclamation ne garantit pas un remboursement. Première Services ne promet pas de dommages consécutifs illimités ni de payer tous les dommages causés par des professionnels.",
  },
} as const;

/** Document versions for acceptance logging (bump when counsel-approved text changes). */
export const LEGAL_DOCUMENT_VERSIONS = {
  website_terms: { version: "2026-03-draft", hash: "terms-2026-03-draft" },
  client_booking_terms: { version: "2026-03-draft", hash: "client-booking-2026-03-draft" },
  professional_agreement: { version: "2026-03-draft", hash: "pro-agreement-2026-03-draft" },
  privacy_policy: { version: "2026-08-draft", hash: "privacy-2026-08-draft" },
  cookie_policy: { version: "2026-08-draft", hash: "cookie-2026-08-draft" },
  cancellation_policy_framework: { version: "2026-08-draft", hash: "cancel-framework-2026-08-draft" },
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_VERSIONS;

/** Retention knobs (days). Do not invent legal periods — counsel must approve. */
export const RETENTION_CONFIG = {
  clientIdVerificationDays: null as number | null, // REVIEW_REQUIRED
  claimEvidenceDays: null as number | null, // REVIEW_REQUIRED
  accountDeletionGraceDays: 30, // operational default; LEGAL_REVIEW_REQUIRED
  signedUrlTtlSeconds: 300,
} as const;

export const COOKIE_CATEGORIES = ["necessary", "preferences", "analytics", "marketing"] as const;
export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];

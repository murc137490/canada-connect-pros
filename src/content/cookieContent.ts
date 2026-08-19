/**
 * Draft Cookie Policy — FR/EN.
 * LEGAL_REVIEW_REQUIRED (LR-004).
 */
import { PRIVACY_CONTACT, SUPPORT_EMAIL } from "@/config/legalConfig";

export const COOKIE_POLICY_LAST_UPDATED = "August 2026";
export const COOKIE_POLICY_LAST_UPDATED_FR = "août 2026";
export const COOKIE_POLICY_VERSION = "2026-08-draft";

export type CookieSection = { title: string; body: string };

export const COOKIE_SECTIONS_EN: CookieSection[] = [
  {
    title: "1. Overview",
    body: `This Cookie Policy explains how Première Services uses cookies and similar technologies (including local storage) on https://www.premiereservices.ca.

Contact: ${PRIVACY_CONTACT.email} · Support: ${SUPPORT_EMAIL}

[REVIEW_REQUIRED — LR-004.]`,
  },
  {
    title: "2. Categories",
    body: `• Necessary — required for security, authentication, load balancing, and core features. These cannot be turned off while using the site.
• Preferences — language, theme, and similar choices you make.
• Analytics — optional measurement of site usage (disabled until you opt in).
• Marketing — optional advertising/remarketing (disabled until you opt in; currently not actively deployed by default).`,
  },
  {
    title: "3. Your choices",
    body: `On first visit you can Accept non-essential cookies or Refuse them. Necessary cookies remain active. You can change your choice later from the Cookie Policy page or by clearing site data and revisiting.

Refusing non-essential cookies does not block login or booking.`,
  },
  {
    title: "4. Changes",
    body: `We may update this policy. The “Last updated” date will change.`,
  },
];

export const COOKIE_SECTIONS_FR: CookieSection[] = [
  {
    title: "1. Aperçu",
    body: `La présente politique explique comment Première Services utilise les témoins et technologies similaires (dont le stockage local) sur https://www.premiereservices.ca.

Contact : ${PRIVACY_CONTACT.email} · Soutien : ${SUPPORT_EMAIL}

[REVIEW_REQUIRED — LR-004.]`,
  },
  {
    title: "2. Catégories",
    body: `• Nécessaires — sécurité, authentification et fonctions de base.
• Préférences — langue, thème et choix similaires.
• Analytique — mesure d’utilisation (désactivée jusqu’à consentement).
• Marketing — publicité/remarketing optionnelle (désactivée par défaut; non déployée activement par défaut).`,
  },
  {
    title: "3. Vos choix",
    body: `À la première visite, vous pouvez Accepter ou Refuser les témoins non essentiels. Les témoins nécessaires restent actifs. Vous pouvez modifier votre choix plus tard sur cette page ou en effaçant les données du site.

Refuser les témoins non essentiels n’empêche pas la connexion ni la réservation.`,
  },
  {
    title: "4. Modifications",
    body: `Nous pouvons mettre à jour cette politique. La date de mise à jour sera modifiée.`,
  },
];

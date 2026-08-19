/**
 * Draft Privacy Policy — FR/EN.
 * LEGAL_REVIEW_REQUIRED (LR-003). Placeholders must not be treated as counsel-approved.
 */
import { LEGAL_ENTITY_NAME, PRIVACY_CONTACT, SUPPORT_EMAIL } from "@/config/legalConfig";

export const PRIVACY_LAST_UPDATED = "August 2026";
export const PRIVACY_LAST_UPDATED_FR = "août 2026";
export const PRIVACY_VERSION = "2026-08-draft";

export type PrivacySection = { title: string; body: string };

export const PRIVACY_SECTIONS_EN: PrivacySection[] = [
  {
    title: "1. Who we are",
    body: `This Privacy Policy describes how ${LEGAL_ENTITY_NAME} (“Première Services”, “we”, “us”) collects and uses personal information when you use https://www.premiereservices.ca and related services.

Privacy contact: ${PRIVACY_CONTACT.title} — ${PRIVACY_CONTACT.name} — ${PRIVACY_CONTACT.email}
Support: ${SUPPORT_EMAIL}

[REVIEW_REQUIRED — LR-001 / LR-002: confirm legal entity name and privacy contact identity.]`,
  },
  {
    title: "2. Information we collect",
    body: `Depending on how you use the Platform, we may collect:
• Account information (name, email, phone, preferred language, birthday where provided)
• Address / postal code and approximate location derived from postal/geocoding
• Professional profile information (business details, services, photos, tax registration numbers where provided)
• Booking and job-request information (schedules, messages, quotes, invoices)
• Payment-related metadata processed by Square (amounts, status, limited card metadata such as brand/last4 — we do not store full card numbers)
• Identity-verification images (e.g. government ID for bookings or pro applications)
• Reviews, ratings, and claim/dispute materials (including evidence photos)
• Support/AI chat content you send to Help
• Technical data (device/browser, cookies/local storage preferences, logs)

[REVIEW_REQUIRED — confirm exhaustive categories with counsel.]`,
  },
  {
    title: "3. Purposes of use",
    body: `We use personal information to:
• Create and manage accounts
• Operate the marketplace (matching, bookings, quotes, messaging related to jobs)
• Process payments and subscriptions via Square
• Verify identity for safety of bookings and pro onboarding
• Provide customer support and review claims
• Improve security, prevent fraud/abuse
• Meet legal, tax, and accounting obligations
• Send operational emails/SMS where enabled

We do not sell personal information.

[REVIEW_REQUIRED — Law 25 purposes / consent mapping.]`,
  },
  {
    title: "4. Disclosure",
    body: `We may disclose personal information to:
• The professional or client involved in a booking (as needed to perform the booking — e.g. contact and schedule details)
• Payment processor (Square)
• Infrastructure and communication providers (e.g. hosting, email, SMS, maps/geocoding, support AI vendor)
• Platform administrators for verification, moderation, and claims
• Authorities when required by law

Identity verification: professionals generally see that a client’s identity has been verified for a booking (“Identité vérifiée”), not the government ID image itself, unless a future counsel-approved process requires otherwise.

[REVIEW_REQUIRED — LR-007.]`,
  },
  {
    title: "5. Storage, security, and retention",
    body: `Information is stored using third-party infrastructure (including Supabase storage and databases). We apply access controls and aim to keep sensitive files (such as government ID images and claim evidence) in private storage with authenticated access.

Retention periods for identity documents, financial records, and claims evidence are configurable and subject to legal retention duties.

[REVIEW_REQUIRED — LR-013: approve retention schedules.]`,
  },
  {
    title: "6. Cross-border processing",
    body: `Some providers may process data outside Quebec/Canada. See our internal third-party inventory and ask support for current vendor list.

[REVIEW_REQUIRED — LR-018: transfers / DPAs.]`,
  },
  {
    title: "7. Cookies and similar technologies",
    body: `We use necessary cookies/local storage for basic site function (session, security, language/theme preferences). Non-essential analytics/marketing are off by default until you consent. See the Cookie Policy.`,
  },
  {
    title: "8. AI / automated processing",
    body: `Our Help assistant may send the text of your support conversation to an AI provider to generate answers about Première Services. Do not paste government IDs, passwords, or full payment card details into chat. AI answers are informational and may be incomplete.

[REVIEW_REQUIRED — LR for automated decision disclosures if expanded.]`,
  },
  {
    title: "9. Access, correction, and deletion",
    body: `You may request access to or correction of your personal information, or request account/data deletion, via Dashboard (deletion request) or by emailing ${PRIVACY_CONTACT.email}. Some records (e.g. invoices, fraud/security logs) may be retained where required.

[REVIEW_REQUIRED — LR-013.]`,
  },
  {
    title: "10. Children",
    body: `The Platform is intended for users 18+. We do not knowingly collect information from children under 18.`,
  },
  {
    title: "11. Changes",
    body: `We may update this Policy. The “Last updated” date will change. Material changes may require renewed notice or acceptance where appropriate.

[REVIEW_REQUIRED — notice process.]`,
  },
  {
    title: "12. Contact",
    body: `${PRIVACY_CONTACT.title}: ${PRIVACY_CONTACT.name}
Email: ${PRIVACY_CONTACT.email}
Support: ${SUPPORT_EMAIL}`,
  },
];

export const PRIVACY_SECTIONS_FR: PrivacySection[] = [
  {
    title: "1. Qui nous sommes",
    body: `La présente Politique de confidentialité décrit comment ${LEGAL_ENTITY_NAME} (« Première Services », « nous ») recueille et utilise des renseignements personnels lorsque vous utilisez https://www.premiereservices.ca et les services connexes.

Contact confidentialité : ${PRIVACY_CONTACT.title} — ${PRIVACY_CONTACT.name} — ${PRIVACY_CONTACT.email}
Soutien : ${SUPPORT_EMAIL}

[REVIEW_REQUIRED — LR-001 / LR-002 : confirmer la dénomination légale et l’identité du contact.]`,
  },
  {
    title: "2. Renseignements recueillis",
    body: `Selon votre utilisation, nous pouvons recueillir :
• Compte (nom, courriel, téléphone, langue, date de naissance le cas échéant)
• Adresse / code postal et localisation approximative
• Profil professionnel (entreprise, services, photos, numéros de taxes le cas échéant)
• Réservations et demandes (horaires, messages, soumissions, factures)
• Métadonnées de paiement via Square (montants, statut, métadonnées limitées de carte — pas le numéro complet)
• Images de vérification d’identité (ex. pièce d’identité)
• Avis, réclamations et preuves
• Contenu d’assistance / clavardage d’aide
• Données techniques (appareil, cookies/préférences, journaux)

[REVIEW_REQUIRED.]`,
  },
  {
    title: "3. Fins d’utilisation",
    body: `Nous utilisons les renseignements pour : gérer les comptes; exploiter la place de marché; traiter les paiements; vérifier l’identité; fournir du soutien et examiner les réclamations; assurer la sécurité; respecter des obligations légales/fiscales; envoyer des communications opérationnelles.

Nous ne vendons pas les renseignements personnels.

[REVIEW_REQUIRED — Loi 25.]`,
  },
  {
    title: "4. Communication",
    body: `Nous pouvons communiquer des renseignements au professionnel ou client concerné par une réservation; à Square; aux fournisseurs d’infrastructure (hébergement, courriel, SMS, cartes, IA d’aide); aux administrateurs; aux autorités lorsque la loi l’exige.

Vérification d’identité : les professionnels voient en principe que l’identité du client a été vérifiée (« Identité vérifiée »), et non l’image de la pièce d’identité, sauf processus futur approuvé.

[REVIEW_REQUIRED — LR-007.]`,
  },
  {
    title: "5. Conservation, sécurité et rétention",
    body: `Les renseignements sont hébergés via des fournisseurs (dont Supabase). Les fichiers sensibles (pièces d’identité, preuves de réclamation) sont destinés à un stockage privé avec accès authentifié.

Les durées de rétention sont configurables et assujetties aux obligations légales.

[REVIEW_REQUIRED — LR-013.]`,
  },
  {
    title: "6. Traitement hors Québec / Canada",
    body: `Certains fournisseurs peuvent traiter des données hors Québec/Canada. Voir l’inventaire interne des tiers ou écrivez au soutien.

[REVIEW_REQUIRED — LR-018.]`,
  },
  {
    title: "7. Témoins (cookies)",
    body: `Nous utilisons des témoins/stockage local nécessaires au fonctionnement. Les catégories non essentielles (analytique/marketing) sont désactivées par défaut jusqu’à consentement. Voir la Politique relative aux témoins.`,
  },
  {
    title: "8. IA / traitement automatisé",
    body: `L’assistant d’aide peut transmettre le texte de votre conversation à un fournisseur d’IA. N’y collez pas de pièces d’identité, mots de passe ou numéros de carte. Les réponses sont informatives.

[REVIEW_REQUIRED.]`,
  },
  {
    title: "9. Accès, rectification et suppression",
    body: `Vous pouvez demander l’accès, la rectification ou la suppression via le Tableau de bord (demande de suppression) ou ${PRIVACY_CONTACT.email}. Certains dossiers peuvent être conservés lorsque requis.

[REVIEW_REQUIRED — LR-013.]`,
  },
  {
    title: "10. Mineurs",
    body: `La plateforme est destinée aux personnes de 18 ans et plus.`,
  },
  {
    title: "11. Modifications",
    body: `Nous pouvons mettre à jour cette politique. La date de mise à jour sera modifiée.`,
  },
  {
    title: "12. Contact",
    body: `${PRIVACY_CONTACT.title} : ${PRIVACY_CONTACT.name}
Courriel : ${PRIVACY_CONTACT.email}
Soutien : ${SUPPORT_EMAIL}`,
  },
];

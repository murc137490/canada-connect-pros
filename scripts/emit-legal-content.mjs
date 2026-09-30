/**
 * Emit src/content/termsContent.ts and privacyContent.ts from cleaned MD drafts.
 */
import fs from "fs";

function clean(text) {
  let s = text.replace(/\r\n/g, "\n").trim();
  s = s.replace(/^DRAFT FOR COUNSEL[\s\S]*?(?=\nBrand note:|\nImportant:|\nParties\n|\n1\. )/m, "");
  s = s.replace(/^BROUILLON POUR AVOCAT[\s\S]*?(?=\nNote de marque:|\nImportant :|\nParties\n|\n1\. )/m, "");
  s = s.replace(/^Status:.*\n?/gm, "");
  s = s.replace(/^Statut :.*\n?/gm, "");
  s = s.replace(/\n— End of[\s\S]*$/m, "");
  s = s.replace(/\n— Fin du[\s\S]*$/m, "");
  s = s.replace(/\s*\[COUNSEL[^\]]*\]/gi, "");
  s = s.replace(/\s*\[AVOCAT[^\]]*\]/gi, "");
  s = s.replace(/\s*\[CHOIX AVOCAT[^\]]*\]/gi, "");
  s = s.replace(/\s*\[PHONE optional\]/gi, "");
  s = s.replace(/\s*\[TÉLÉPHONE optionnel\]/gi, "");
  s = s.replace(/\[support email — confirm before publication\]/gi, "support@altshift.ca");
  s = s.replace(/\[courriel de soutien — confirmer avant publication\]/gi, "support@altshift.ca");
  s = s.replace(/\nWhy this section changed:[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\nResearch note \(not legal advice\):[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\nPourquoi cette section a changé :[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\nNote de recherche \(pas un avis juridique\) :[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function toSections(docTitle, body) {
  const text = body.trim();
  const sections = [];
  const parts = text.split(/\n(?=\d+\.\s)/);
  const preamble = parts[0].trim();
  if (preamble) sections.push({ title: docTitle, body: preamble });
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i].trim();
    const m = chunk.match(/^(\d+\.\s+[^\n]+)\n([\s\S]*)$/);
    if (m) sections.push({ title: m[1].trim(), body: m[2].trim() });
    else {
      const first = chunk.split("\n")[0];
      sections.push({ title: first, body: chunk.slice(first.length).trim() });
    }
  }
  return sections;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function sectionsLiteral(sections) {
  return (
    "[\n" +
    sections
      .map(
        (sec) =>
          `  {\n    title: ${JSON.stringify(sec.title)},\n    body: \`${esc(sec.body)}\`,\n  }`,
      )
      .join(",\n") +
    ",\n]"
  );
}

const consumerEn = toSections(
  "Consumer Terms of Service",
  clean(fs.readFileSync("tmp-legal/consumer-en.md", "utf8")),
);
const consumerFr = toSections(
  "Conditions d'utilisation",
  clean(fs.readFileSync("tmp-legal/consumer-fr.md", "utf8")),
);
const proEn = toSections(
  "Professional Service Provider Agreement",
  clean(fs.readFileSync("tmp-legal/pro-en.md", "utf8")),
);
const proFr = toSections(
  "Contrat de prestataire de services professionnels",
  clean(fs.readFileSync("tmp-legal/pro-fr.md", "utf8")),
);
const privacyEn = toSections(
  "Privacy Policy",
  clean(fs.readFileSync("tmp-legal/privacy-en.md", "utf8")),
);
const privacyFr = toSections(
  "Politique de confidentialité",
  clean(fs.readFileSync("tmp-legal/privacy-fr.md", "utf8")),
);

const termsTs = `/**
 * Consumer Terms of Service and Professional Service Provider Agreement (EN/FR).
 * Source: Les Services AltShift Inc. marketplace terms for altshift.ca.
 */

export const LAST_UPDATED = "September 2026";
export const LAST_UPDATED_FR = "septembre 2026";
export const COMPANY_NAME = "AltShift";
export const LEGAL_COMPANY_NAME = "Les Services AltShift Inc.";

/** Terms shown when a client requests a booking (client-only). */
export const TERMS_SUMMARY_BOOKING = \`
TERMS APPLICABLE TO BOOKING A SERVICE

Last Updated: \${LAST_UPDATED}

By requesting a booking you agree to the following:

1. PLATFORM ROLE
The Platform connects you with independent Pros. The service job is generally a contract between you and the Pro. Company provides the marketplace and payment facilitation.

2. PRICE AND FEES
Before you book, the Platform shows the price elements that apply, including amounts payable to the Pro and any Platform-related charges that apply to you. Amounts payable are those shown at enrollment and checkout. Payment is processed via Square.

3. YOUR RESPONSIBILITIES
You must provide accurate information, keep login credentials secure, and use the Platform lawfully.

4. CANCELLATION
Each Pro listing states a free-cancellation cutoff (for example, cancel free until 24 hours before the appointment). If you cancel after that cutoff, you remain responsible only for the Pro’s actual, reasonably proven damages (for example, materials bought specifically for your job that cannot be reused, or documented travel already incurred)—not a pre-set percentage of the job or an automatic full job price solely because you cancelled. If a booking deposit was collected, any amount beyond proven actual loss will be refunded. If the Pro cancels or fails to perform, you may be entitled to a refund and other remedies at law.

5. GOVERNMENT PHOTO ID
For some bookings you may be asked to upload the front of a government photo ID. The image is shown only to the Pro assigned to that booking for identity confirmation. Pros must not download, copy, share, or retain it after the booking. Company retains it only as described in the Privacy Policy. Providing ID is voluntary unless necessary for the contract.

6. REVIEWS AND ACCEPTABLE USE
Reviews must be honest and lawful. You must not misuse the Platform, harass Pros or staff, circumvent security, scrape data unlawfully, or book with intent to defraud.

7. ACCEPTANCE
By continuing, you confirm that you have read and accepted these Terms as they apply to your booking. Full Terms are available on the Platform.
\`.trim();

export const TERMS_SUMMARY_BOOKING_FR = \`
CONDITIONS APPLICABLES À LA RÉSERVATION D’UN SERVICE

Dernière mise à jour : \${LAST_UPDATED_FR}

En demandant une réservation, vous acceptez ce qui suit :

1. RÔLE DE LA PLATEFORME
La Plateforme vous met en relation avec des Pros indépendants. Le travail de service est généralement un contrat entre vous et le Pro. La Société fournit le marché en ligne et la facilitation de paiement.

2. PRIX ET FRAIS
Avant de réserver, la Plateforme affiche les éléments de prix applicables, y compris les montants payables au Pro et tout frais lié à la Plateforme qui vous est applicable. Les montants payables sont ceux affichés à l’inscription et au paiement. Le paiement est traité via Square.

3. VOS RESPONSABILITÉS
Vous devez fournir des renseignements exacts, protéger vos identifiants et utiliser la Plateforme de façon licite.

4. ANNULATION
Chaque annonce de Pro indique une échéance d’annulation gratuite (par exemple, jusqu’à 24 heures avant le rendez-vous). Si vous annulez après cette échéance, vous n’êtes responsable que des dommages réels, raisonnablement prouvés du Pro (par exemple, matériaux achetés spécifiquement pour votre travail qui ne peuvent être réutilisés, ou déplacements documentés déjà engagés)—et non un pourcentage prédéterminé ni un prix intégral automatique du seul fait que vous avez annulé. Si un dépôt a été perçu, tout montant excédant la perte réelle prouvée sera remboursé. Si le Pro annule ou n’exécute pas, vous pouvez avoir droit au remboursement et à d’autres recours en droit.

5. PIÈCE D’IDENTITÉ
Pour certaines réservations, on peut vous demander de téléverser le recto d’une pièce d’identité avec photo délivrée par le gouvernement. L’image est montrée uniquement au Pro assigné pour confirmer l’identité. Les Pros ne doivent pas la télécharger, copier, partager ni conserver après la réservation. La Société la conserve uniquement comme décrit dans la Politique de confidentialité. Fournir une pièce d’identité est volontaire sauf si nécessaire au contrat.

6. ÉVALUATIONS ET UTILISATION ACCEPTABLE
Les évaluations doivent être honnêtes et licites. Vous ne devez pas faire un usage abusif de la Plateforme, harceler, contourner la sécurité, extraire des données illégalement, ni réserver dans l’intention de frauder.

7. ACCEPTATION
En continuant, vous confirmez avoir lu et accepté ces Conditions telles qu’elles s’appliquent à votre réservation. Les Conditions complètes sont disponibles sur la Plateforme.
\`.trim();

export const TERMS_SUMMARY_PRO = \`
PROFESSIONAL SERVICE PROVIDER – TERMS

Last Updated: \${LAST_UPDATED}

By registering as a professional service provider you agree to the following:

1. INDEPENDENT CONTRACTOR STATUS
You are an independent contractor under a contract of enterprise / for services (Civil Code of Québec arts. 2098–2099), not an employee of Company.

2. ELIGIBILITY AND ONBOARDING
You must be 18+, legally able to contract in Québec, complete identity verification (government photo ID and selfie), supply licence/permit numbers for regulated categories, and obtain Company approval before public listing.

3. VERIFIED CLAIMS
Badges such as “licence checked” or “ID reviewed” mean only the limited check described on the Platform as of the stated date—not continuous monitoring, insurance confirmation, skills testing, or criminal background clearance.

4. FEES AND SUBSCRIPTION
Subscription plans and platform fees are those shown at enrollment and checkout (billed via Square). You are responsible for your own taxes. You must not steer Clients off-Platform to avoid fees for bookings that originated on the Platform, except for a documented pre-existing client relationship.

5. CANCELLATION POLICIES YOU MAY OFFER
You may offer free cancellation until a clearly stated cutoff and/or, after the cutoff, liability for your actual reasonably proven damages—not a pre-set percentage or automatic full charge. Optional fixed-dollar deposits must be precisely disclosed before booking; unused portions must be refunded.

6. CLIENT GOVERNMENT ID
Client ID images for a booking are visible only to you as the assigned Pro, for identity confirmation at the job. You must not download, screenshot, copy, store, share, or retain the image after the booking ends (except as required by law). Breach may result in suspension and liability.

7. INSURANCE AND STANDARDS
You represent that you carry insurance appropriate to your trade and must upload a certificate when required. You must perform services with reasonable care and skill and not misrepresent qualifications.

8. ACCEPTANCE
By continuing, you confirm that you have read and accepted this Professional Service Provider Agreement. The full Agreement is available on the Platform.
\`.trim();

export const TERMS_SUMMARY_PRO_FR = \`
FOURNISSEUR DE SERVICES PROFESSIONNELS – CONDITIONS

Dernière mise à jour : \${LAST_UPDATED_FR}

En vous inscrivant comme fournisseur, vous acceptez notamment :

1. STATUT D’ENTREPRENEUR INDÉPENDANT
Vous êtes entrepreneur indépendant en vertu d’un contrat d’entreprise ou pour services (C.c.Q. arts. 2098–2099), et non salarié de la Société.

2. ADMISSIBILITÉ ET INTÉGRATION
Vous devez avoir 18 ans ou plus, être apte à contracter au Québec, compléter la vérification d’identité (pièce d’identité et selfie), fournir les numéros de licence/permis pour les catégories réglementées, et obtenir l’approbation de la Société avant l’annonce publique.

3. MENTIONS « VÉRIFIÉ »
Les badges tels que « licence vérifiée » ou « pièce d’identité examinée » signifient uniquement le contrôle limité décrit sur la Plateforme à la date indiquée—pas une surveillance continue, une confirmation d’assurance, un test de compétences ou une vérification d’antécédents.

4. FRAIS ET ABONNEMENT
Les forfaits et frais de plateforme sont ceux affichés à l’inscription et au paiement (facturation via Square). Vous êtes responsable de vos taxes. Vous ne devez pas détourner les Clients hors Plateforme pour éviter les frais, sauf relation client préexistante documentée.

5. POLITIQUES D’ANNULATION
Vous pouvez offrir une annulation gratuite jusqu’à une échéance claire et/ou, après l’échéance, la responsabilité pour vos dommages réels raisonnablement prouvés—pas un pourcentage prédéterminé ni une facturation intégrale automatique. Les dépôts optionnels à montant fixe doivent être précisément divulgués; toute portion inutilisée doit être remboursée.

6. PIÈCE D’IDENTITÉ DU CLIENT
Les images de pièce d’identité du Client sont visibles uniquement à vous en tant que Pro assigné, pour confirmer l’identité sur place. Vous ne devez pas télécharger, capturer, copier, stocker, partager ni conserver l’image après la réservation (sauf exigence légale). Une violation peut entraîner une suspension et une responsabilité.

7. ASSURANCE ET NORMES
Vous déclarez détenir une assurance adaptée et devez téléverser un certificat lorsque requis. Vous devez exécuter les services avec soin et compétence raisonnables et ne pas faussement représenter vos qualifications.

8. ACCEPTATION
En continuant, vous confirmez avoir lu et accepté le Contrat de prestataire de services professionnels. Le Contrat complet est disponible sur la Plateforme.
\`.trim();

export const TERMS_FULL_SECTIONS = ${sectionsLiteral(consumerEn)};

export const TERMS_FULL_SECTIONS_FR = ${sectionsLiteral(consumerFr)};

export const TERMS_PROVIDER_AGREEMENT = ${sectionsLiteral(proEn)};

export const TERMS_PROVIDER_AGREEMENT_FR = ${sectionsLiteral(proFr)};
`;

const privacyTs = `/**
 * Privacy Policy (EN/FR) for Les Services AltShift Inc. / altshift.ca.
 */

export const PRIVACY_LAST_UPDATED = "September 2026";
export const PRIVACY_LAST_UPDATED_FR = "septembre 2026";
export const PRIVACY_VERSION = "2026-09";

export type PrivacySection = { title: string; body: string };

export const PRIVACY_SECTIONS_EN: PrivacySection[] = ${sectionsLiteral(privacyEn)};

export const PRIVACY_SECTIONS_FR: PrivacySection[] = ${sectionsLiteral(privacyFr)};
`;

fs.writeFileSync("src/content/termsContent.ts", termsTs);
fs.writeFileSync("src/content/privacyContent.ts", privacyTs);
console.log("wrote", {
  terms: termsTs.length,
  privacy: privacyTs.length,
  consumerEn: consumerEn.length,
  consumerFr: consumerFr.length,
  proEn: proEn.length,
  proFr: proFr.length,
  privacyEn: privacyEn.length,
  privacyFr: privacyFr.length,
});

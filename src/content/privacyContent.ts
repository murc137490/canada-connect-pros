/**
 * Privacy Policy (EN/FR) for Les Services AltShift Inc. / altshift.ca.
 */

export const PRIVACY_LAST_UPDATED = "September 2026";
export const PRIVACY_LAST_UPDATED_FR = "septembre 2026";
export const PRIVACY_VERSION = "2026-09";

export type PrivacySection = { title: string; body: string };

export const PRIVACY_SECTIONS_EN: PrivacySection[] = [
  {
    title: "Privacy Policy",
    body: `Controller: Les Services AltShift Inc. (“Company,” “we”). Public site: altshift.ca. “The Platform” means that marketplace.

Person in charge of the protection of personal information (privacy officer):
support@altshift.ca until a named officer is set
(Title and contact information are published on the enterprise’s website — Act respecting the protection of personal information in the private sector, CQLR c P-39.1, s. 3.1.)`,
  },
  {
    title: "1. Scope",
    body: `This Policy explains how Company collects, uses, discloses, retains, and destroys personal information of Clients, Pros, and visitors in the course of operating the Platform in Québec, under P-39.1 as amended (commonly associated with “Law 25”), the Civil Code of Québec (arts. 35–40), and, where applicable, the Act to establish a legal framework for information technology, CQLR c C-1.1 (biometric rules).

Personal information means any information which relates to a natural person and directly or indirectly allows that person to be identified (P-39.1 s. 2).`,
  },
  {
    title: "2. What we collect",
    body: `Category — Examples — Typical sources
Account — Name, email, phone, password hash, address/service area, language preference — You
Pro profile — Trade categories, bio, rates, availability, photos you upload — You
Government photo ID (Clients) — Image of the front of a government photo ID — You (upload)
Government photo ID & selfie (Pros) — ID image; selfie for identity verification — You (upload)
Licence / permit numbers — RBQ, BSP, MAPAQ, pesticide, professional-order, SAAQ school recognition numbers, etc. — You; public registers for verification
Booking data — Service requested, time, location, messages, cancellation events, reviews — You / Pro / Platform
Payment — Payment status, last-4 / tokenized references; card data handled by Square — Square / you
Technical — IP address, device/browser data, cookies / similar tech — Automated
Support — Tickets, chat transcripts (including with AI assistant) — You

We determine purposes before collection (P-39.1 s. 4) and collect only what is necessary for those purposes (s. 5).`,
  },
  {
    title: "3. Why we collect (purposes)",
    body: `Create and administer accounts;
Match Clients with Pros and manage bookings;
Verify Pro identity and, where applicable, licence status against public sources;
Show Client ID to the assigned Pro only, so the Pro can confirm identity for that booking;
Process payments via Square and prevent fraud;
Provide support (including disclosing when support is AI, not human);
Improve safety and Platform integrity;
Comply with law and respond to lawful requests;
Send service messages; marketing only with valid consent where required.

Sensitive information (including information that is biometric or otherwise intimate, or that entails a high expectation of privacy given context — P-39.1 s. 12) requires express consent for use/communication beyond permitted exceptions (ss. 12–14).`,
  },
  {
    title: "4. Government ID images (Clients) — who sees them",
    body: `4.1 Who: Only Company personnel who need access for support/security, and the Pro assigned to that specific booking.
4.2 Purpose limit: Identity confirmation and safety for that booking only.
4.3 Pro restrictions: Pros must not download, copy, share, or retain the Client ID after the booking. Access may be logged.
4.4 Not used for: Marketing, sale of data, or unrelated profiling.
4.5 Consent / necessity: We inform you at collection of purposes, means, access/rectification rights, and right to withdraw consent to communication/use (P-39.1 s. 8). We identify categories of third persons to whom communication is necessary (assigned Pro; processors). Consent for sensitive information must be express (ss. 13–14).
4.6 Minimization: Prefer front-of-ID only; avoid collecting back-of-ID or unnecessary numbers when not needed.`,
  },
  {
    title: "5. Selfie and biometric verification (Pros; possibly Clients)",
    body: `5.1 If we use a process that allows biometric characteristics or measurements to verify or confirm identity, C-1.1 s. 44 requires: prior disclosure to the CAI; express consent of the person; only the minimum characteristics needed; destruction of the record when the purpose is met or the reason no longer exists.
5.2 Creating a database of biometric characteristics/measurements must be disclosed to the CAI promptly and not later than 60 days before it is brought into service (C-1.1 s. 45).
5.3 Necessity must be demonstrated; a non-biometric alternative is offered when required; consent cannot cure lack of necessity.`,
  },
  {
    title: "6. Licence numbers and public registers",
    body: `6.1 A licence or permit number that relates to an identifiable natural person is generally personal information (P-39.1 s. 2). Some professional information may be publicly available; Divisions II and III of P-39.1 do not apply to personal information which by law is public (s. 1, last paras.).
6.2 We store numbers you provide and may check them against public sources (RBQ open data; BSP public register; MAPAQ list; MELCCFP pesticide registers; Ordre des CPA; Ordre des psychologues; SAAQ recognized driving-school lists).
6.3 We will not claim a Pro is “fully verified by government” if we only performed a partial public lookup.`,
  },
  {
    title: "7. Disclosure to third parties",
    body: `We may communicate personal information:
to the assigned Pro (Client ID / booking details needed for the job);
to processors who provide hosting, analytics, support tooling, or identity tools, under written contracts with confidentiality measures (see P-39.1 s. 18.3 for mandataries / contracts of enterprise);
to Square for payments;
when required by law or s. 18 exceptions;
with your consent.
We do not sell personal information.`,
  },
  {
    title: "8. Cross-border transfers",
    body: `Before communicating personal information outside Québec, we conduct a privacy impact assessment considering sensitivity, purposes, contractual protections, and the legal framework of the destination State, and use a written agreement if the assessment establishes adequate protection (P-39.1 s. 17).
Some providers may process data outside Québec; we assess and contract for adequate protection as required by law.`,
  },
  {
    title: "9. Retention and destruction",
    body: `When purposes are achieved, we destroy personal information or anonymize it for serious and legitimate purposes, subject to legal preservation periods (P-39.1 s. 23).
Illustrative periods:
account data: life of account + reasonable wind-down;
Client ID images: until booking completed + short dispute window, then destroy unless legal hold;
biometric records: destroy as soon as verification purpose met (C-1.1 s. 44);
transaction records: as required for tax / accounting;
information used to make a decision about a person: at least one year after the decision (P-39.1 s. 11).`,
  },
  {
    title: "10. Security",
    body: `We take security measures reasonable given sensitivity, purposes, quantity, distribution, and medium (P-39.1 s. 10) — access controls, encryption in transit where appropriate, logging of ID access, staff training.`,
  },
  {
    title: "11. Cookies and similar technologies",
    body: `We use cookies / similar tools as described in our Cookie Notice. Privacy settings for technological products/services default to the highest confidentiality level, except browser cookies (P-39.1 s. 9.1). If we use technology to identify, locate, or profile, we inform you first and of means to activate those functions (s. 8.1).`,
  },
  {
    title: "12. Automated decisions",
    body: `If we render a decision based exclusively on automated processing of personal information, we will inform you no later than when we inform you of the decision, and provide the rights in P-39.1 s. 12.1 (including chance to submit observations to a person who can review).`,
  },
  {
    title: "13. Your rights (Law 25 / P-39.1)",
    body: `Subject to legal limits, you may:
Access personal information we hold about you (s. 27);
Rectify inaccurate, incomplete, or equivocal information, or information collected/kept without authorization (s. 28);
Request deletion / cessation of dissemination / de-indexation in the cases provided (ss. 23, 28.1 and related);
Withdraw consent to use/communication where consent is the basis (ss. 8, 14);
Data portability of certain computerized information you provided (s. 27);
File a complaint with our privacy officer and, if needed, apply to the Commission d’accès à l’information.
We respond in writing within 30 days of a written request to the privacy officer (s. 32). Access is free of charge subject to reasonable transcription fees with advance notice (s. 33).`,
  },
  {
    title: "14. Confidentiality incidents (breaches)",
    body: `If a confidentiality incident occurs (unauthorized access, use, communication, or loss — s. 3.6), we take reasonable measures to reduce risk (s. 3.5). If there is a risk of serious injury, we promptly notify the CAI and affected persons (s. 3.5). We keep an incident register (s. 3.8).
Breach contact: privacy officer above, and support@altshift.ca.`,
  },
  {
    title: "15. AI support disclosure",
    body: `Support chats may be handled by an AI assistant that is not human. Transcripts may be personal information and are handled under this Policy.`,
  },
  {
    title: "16. Children",
    body: `We do not knowingly collect personal information from persons under 18 for Platform accounts. Collection from a minor under 14 has additional parental/tutor consent rules (s. 4.1).`,
  },
  {
    title: "17. Changes to this Policy",
    body: `We publish amendments by appropriate means (s. 8.2). Material changes will be highlighted.`,
  },
  {
    title: "18. Contact",
    body: `Privacy officer: support@altshift.ca until a named officer is set
Company: Les Services AltShift Inc.
Address: 1058 impasse de la Bleuetière, J2J 0C4
Support: support@altshift.ca
CAI: https://www.cai.gouv.qc.ca/`,
  },
];

export const PRIVACY_SECTIONS_FR: PrivacySection[] = [
  {
    title: "Politique de confidentialité",
    body: `Responsable du traitement : Les Services AltShift Inc. (la « Société », « nous »). Site public : altshift.ca. « La Plateforme » désigne ce marché en ligne.

Personne responsable de la protection des renseignements personnels (responsable de la confidentialité) :
support@altshift.ca jusqu’à la désignation d’un responsable nommé
(Le titre et les coordonnées sont publiés sur le site Web de l’entreprise — Loi sur la protection des renseignements personnels dans le secteur privé, RLRQ c P-39.1, art. 3.1.)`,
  },
  {
    title: "1. Portée",
    body: `La présente Politique explique comment la Société recueille, utilise, communique, conserve et détruit les renseignements personnels des Clients, des Pros et des visiteurs dans le cadre de l’exploitation de la Plateforme au Québec, en vertu de P-39.1 telle que modifiée (couramment associée à la « Loi 25 »), du Code civil du Québec (arts. 35–40) et, le cas échéant, de la Loi concernant le cadre juridique des technologies de l’information, RLRQ c C-1.1 (règles biométriques).

Les renseignements personnels s’entendent de tout renseignement qui concerne une personne physique et permet de l’identifier directement ou indirectement (P-39.1 art. 2).`,
  },
  {
    title: "2. Ce que nous recueillons",
    body: `Catégorie — Exemples — Sources typiques
Compte — Nom, courriel, téléphone, empreinte de mot de passe, adresse/zone de service, préférence linguistique — Vous
Profil Pro — Catégories de métiers, bio, tarifs, disponibilité, photos que vous téléversez — Vous
Pièce d’identité avec photo (Clients) — Image du recto d’une pièce d’identité avec photo délivrée par le gouvernement — Vous (téléversement)
Pièce d’identité avec photo et selfie (Pros) — Image de la pièce d’identité; selfie pour vérification d’identité — Vous (téléversement)
Numéros de licence / permis — RBQ, BSP, MAPAQ, pesticides, ordre professionnel, reconnaissance d’école SAAQ, etc. — Vous; registres publics pour vérification
Données de réservation — Service demandé, heure, lieu, messages, événements d’annulation, évaluations — Vous / Pro / Plateforme
Paiement — Statut de paiement, 4 derniers chiffres / références tokenisées; données de carte traitées par Square — Square / vous
Technique — Adresse IP, données appareil/navigateur, témoins / technologies similaires — Automatisé
Soutien — Billets, transcriptions de clavardage (y compris avec l’assistant IA) — Vous

Nous déterminons les finalités avant la collecte (P-39.1 art. 4) et ne recueillons que ce qui est nécessaire à ces finalités (art. 5).`,
  },
  {
    title: "3. Pourquoi nous recueillons (finalités)",
    body: `Créer et administrer les comptes;
Mettre en relation Clients et Pros et gérer les réservations;
Vérifier l’identité du Pro et, le cas échéant, le statut de licence auprès de sources publiques;
Montrer la pièce d’identité du Client uniquement au Pro assigné, afin que le Pro puisse confirmer l’identité pour cette réservation;
Traiter les paiements via Square et prévenir la fraude;
Fournir du soutien (y compris divulguer lorsque le soutien est de l’IA, non humain);
Améliorer la sécurité et l’intégrité de la Plateforme;
Respecter la loi et répondre aux demandes légitimes;
Envoyer des messages de service; marketing uniquement avec un consentement valide lorsque requis.

Les renseignements sensibles (y compris les renseignements biométriques ou autrement intimes, ou qui entraînent une forte attente de vie privée compte tenu du contexte — P-39.1 art. 12) exigent un consentement exprès pour l’utilisation/communication au-delà des exceptions permises (arts. 12–14).`,
  },
  {
    title: "4. Images de pièce d’identité délivrée par le gouvernement (Clients) — qui les voit",
    body: `4.1 Qui : Uniquement le personnel de la Société qui a besoin d’y accéder pour le soutien/la sécurité, et le Pro assigné à cette réservation précise.
4.2 Limite de finalité : Confirmation d’identité et sécurité pour cette réservation seulement.
4.3 Restrictions du Pro : Les Pros ne doivent pas télécharger, copier, partager ni conserver la pièce d’identité du Client après la réservation. L’accès peut être consigné.
4.4 Non utilisé pour : Marketing, vente de données ou profilage non lié.
4.5 Consentement / nécessité : Nous vous informons à la collecte des finalités, des moyens, des droits d’accès/rectification et du droit de retirer le consentement à la communication/utilisation (P-39.1 art. 8). Nous identifions les catégories de tiers auxquels la communication est nécessaire (Pro assigné; sous-traitants). Le consentement pour les renseignements sensibles doit être exprès (arts. 13–14).
4.6 Minimisation : Privilégier le recto seulement; éviter de recueillir le verso ou des numéros inutiles lorsqu’ils ne sont pas nécessaires.`,
  },
  {
    title: "5. Selfie et vérification biométrique (Pros; possiblement Clients)",
    body: `5.1 Si nous utilisons un procédé qui permet des caractéristiques ou mesures biométriques pour vérifier ou confirmer l’identité, C-1.1 art. 44 exige : une divulgation préalable à la CAI; le consentement exprès de la personne; uniquement les caractéristiques minimales nécessaires; la destruction de l’enregistrement lorsque la finalité est atteinte ou que la raison n’existe plus.
5.2 La création d’une banque de données de caractéristiques/mesures biométriques doit être divulguée à la CAI sans délai et au plus tard 60 jours avant sa mise en service (C-1.1 art. 45).
5.3 La nécessité doit être démontrée; une solution de rechange non biométrique est offerte lorsque requis; le consentement ne peut pallier l’absence de nécessité.`,
  },
  {
    title: "6. Numéros de licence et registres publics",
    body: `6.1 Un numéro de licence ou de permis qui concerne une personne physique identifiable constitue généralement un renseignement personnel (P-39.1 art. 2). Certains renseignements professionnels peuvent être publiquement accessibles; les sections II et III de P-39.1 ne s’appliquent pas aux renseignements personnels qui sont publics en vertu de la loi (art. 1, derniers al.).
6.2 Nous conservons les numéros que vous fournissez et pouvons les vérifier auprès de sources publiques (données ouvertes RBQ; registre public BSP; liste MAPAQ; registres des pesticides MELCCFP; Ordre des CPA; Ordre des psychologues; listes des écoles de conduite reconnues par la SAAQ).
6.3 Nous ne revendiquerons pas qu’un Pro est « entièrement vérifié par le gouvernement » si nous n’avons effectué qu’un contrôle public partiel.`,
  },
  {
    title: "7. Communication à des tiers",
    body: `Nous pouvons communiquer des renseignements personnels :
au Pro assigné (pièce d’identité du Client / détails de réservation nécessaires au travail);
aux sous-traitants qui fournissent l’hébergement, l’analytique, les outils de soutien ou les outils d’identité, en vertu de contrats écrits comportant des mesures de confidentialité (voir P-39.1 art. 18.3 pour les mandataires / contrats d’entreprise);
à Square pour les paiements;
lorsque la loi ou les exceptions de l’art. 18 l’exigent;
avec votre consentement.
Nous ne vendons pas les renseignements personnels.`,
  },
  {
    title: "8. Transferts hors Québec",
    body: `Avant de communiquer des renseignements personnels hors du Québec, nous procédons à une évaluation des facteurs relatifs à la vie privée tenant compte de la sensibilité, des finalités, des protections contractuelles et du cadre juridique de l’État de destination, et utilisons une entente écrite si l’évaluation établit une protection adéquate (P-39.1 art. 17).
Certains fournisseurs peuvent traiter des données hors du Québec; nous évaluons et contractons pour une protection adéquate comme l’exige la loi.`,
  },
  {
    title: "9. Conservation et destruction",
    body: `Lorsque les finalités sont atteintes, nous détruisons les renseignements personnels ou les anonymisons à des fins sérieuses et légitimes, sous réserve des délais de conservation légaux (P-39.1 art. 23).
Délais illustratifs :
données de compte : durée du compte + période de transition raisonnable;
images de pièce d’identité des Clients : jusqu’à l’achèvement de la réservation + courte fenêtre de différend, puis destruction sauf conservation légale;
enregistrements biométriques : destruction dès que la finalité de vérification est atteinte (C-1.1 art. 44);
dossiers de transaction : selon les exigences fiscales / comptables;
renseignements utilisés pour prendre une décision concernant une personne : au moins un an après la décision (P-39.1 art. 11).`,
  },
  {
    title: "10. Sécurité",
    body: `Nous prenons des mesures de sécurité raisonnables compte tenu de la sensibilité, des finalités, de la quantité, de la répartition et du support (P-39.1 art. 10) — contrôles d’accès, chiffrement en transit le cas échéant, consignation de l’accès aux pièces d’identité, formation du personnel.`,
  },
  {
    title: "11. Témoins et technologies similaires",
    body: `Nous utilisons des témoins / outils similaires comme décrit dans notre Avis relatif aux témoins. Les paramètres de confidentialité des produits/services technologiques sont configurés par défaut au plus haut niveau de confidentialité, sauf les témoins de navigateur (P-39.1 art. 9.1). Si nous utilisons une technologie pour identifier, localiser ou profiler, nous vous en informons d’abord ainsi que des moyens d’activer ces fonctions (art. 8.1).`,
  },
  {
    title: "12. Décisions automatisées",
    body: `Si nous rendons une décision fondée exclusivement sur un traitement automatisé de renseignements personnels, nous vous en informerons au plus tard lorsque nous vous informons de la décision, et fournirons les droits prévus à P-39.1 art. 12.1 (y compris la possibilité de présenter des observations à une personne qui peut réviser).`,
  },
  {
    title: "13. Vos droits (Loi 25 / P-39.1)",
    body: `Sous réserve des limites légales, vous pouvez :
Accéder aux renseignements personnels que nous détenons à votre sujet (art. 27);
Rectifier les renseignements inexacts, incomplets ou équivoques, ou recueillis/conservés sans autorisation (art. 28);
Demander la suppression / la cessation de diffusion / la désindexation dans les cas prévus (arts. 23, 28.1 et connexes);
Retirer le consentement à l’utilisation/communication lorsque le consentement en est le fondement (arts. 8, 14);
La portabilité de certains renseignements informatisés que vous avez fournis (art. 27);
Déposer une plainte auprès de notre responsable de la confidentialité et, au besoin, vous adresser à la Commission d’accès à l’information.
Nous répondons par écrit dans un délai de 30 jours suivant une demande écrite au responsable de la confidentialité (art. 32). L’accès est gratuit sous réserve de frais de transcription raisonnables avec préavis (art. 33).`,
  },
  {
    title: "14. Incidents de confidentialité (atteintes)",
    body: `Si un incident de confidentialité survient (accès, utilisation, communication ou perte non autorisés — art. 3.6), nous prenons des mesures raisonnables pour réduire le risque (art. 3.5). S’il y a un risque de préjudice sérieux, nous avisons sans délai la CAI et les personnes concernées (art. 3.5). Nous tenons un registre des incidents (art. 3.8).
Contact en cas d’atteinte : responsable de la confidentialité ci-dessus, et support@altshift.ca.`,
  },
  {
    title: "15. Divulgation du soutien par IA",
    body: `Les clavardages de soutien peuvent être traités par un assistant IA qui n’est pas humain. Les transcriptions peuvent constituer des renseignements personnels et sont traitées en vertu de la présente Politique.`,
  },
  {
    title: "16. Enfants",
    body: `Nous ne recueillons pas sciemment de renseignements personnels auprès de personnes de moins de 18 ans pour les comptes de la Plateforme. La collecte auprès d’un mineur de moins de 14 ans comporte des règles supplémentaires de consentement parental/du tuteur (art. 4.1).`,
  },
  {
    title: "17. Modifications de la présente Politique",
    body: `Nous publions les modifications par des moyens appropriés (art. 8.2). Les modifications importantes seront mises en évidence.`,
  },
  {
    title: "18. Coordonnées",
    body: `Responsable de la confidentialité : support@altshift.ca jusqu’à la désignation d’un responsable nommé
Société : Les Services AltShift Inc.
Adresse : 1058 impasse de la Bleuetière, J2J 0C4
Soutien : support@altshift.ca
CAI : https://www.cai.gouv.qc.ca/`,
  },
];

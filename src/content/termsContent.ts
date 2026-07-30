/**
 * Platform Terms of Service – summary (for acceptance flow) and full text.
 * Last Updated placeholder: replace with actual date when publishing.
 */

const LAST_UPDATED = "March 2026";
const LAST_UPDATED_FR = "mars 2026";
const COMPANY_NAME = "Premiere Services";

/** Terms shown when a client requests a booking (client-only). */
export const TERMS_SUMMARY_BOOKING = `
TERMS APPLICABLE TO BOOKING A SERVICE

Last Updated: ${LAST_UPDATED}

By requesting a booking you agree to the following:

1. PLATFORM ROLE
The Platform operates as a marketplace connecting you with independent service providers. The Platform does not perform services directly and is not responsible for the conduct, quality, or legality of services provided by professionals.

2. PAYMENTS
Payments for services arranged through the platform must be processed through the platform. The platform may collect a service fee or commission.

3. YOUR RESPONSIBILITIES
You must: provide accurate information; maintain a safe environment for the service; communicate honestly about job requirements.

4. SAFETY AND LIABILITY
Service providers are independent contractors. The platform is not liable for property damage, injury, or disputes resulting from services performed by providers.

5. PLATFORM RULES
You may not: arrange off-platform payments with providers introduced through the platform; submit false reviews; engage in harassment or fraudulent activity.

5A. IDENTITY VERIFICATION (BOOKINGS)
You may be asked to upload a government-issued ID image for booking verification. That image is stored securely and may be shown to the Service Provider assigned to your booking **only to verify your identity** for that booking. Providers must not use ID images for any other purpose or share them with third parties.

6. ACCEPTANCE
By continuing, you confirm that you have read and accepted these Terms as they apply to your booking.
`.trim();

/** Terms shown when a professional registers (pro-only). */
export const TERMS_SUMMARY_PRO = `
PROFESSIONAL SERVICE PROVIDER – TERMS

Last Updated: ${LAST_UPDATED}

By registering as a professional service provider you agree to the following:

1. INDEPENDENT CONTRACTOR STATUS
You are an independent contractor and not an employee of the Platform.

2. ELIGIBILITY
You must: be legally authorized to perform the services you offer; hold required licenses where applicable; comply with applicable laws.

3. PROFESSIONAL STANDARDS
You must: perform services competently; respect client property; maintain professional conduct.

4. INSURANCE
You are responsible for maintaining appropriate liability insurance where required for your services.

5. PRICING, SUBSCRIPTION PLANS, AND PAYOUTS
You set your own pricing. The Platform may charge subscription fees for certain pro plans and commissions or service fees on transactions. Payments collected through the platform will be distributed according to payout schedules after deducting applicable fees. For Starter, Growth, and Pro plans, a platform fee (e.g. 5% of the transaction) may apply to **completed** work that is **booked and paid through the Platform** (the website or app). The exact rates and plan details are shown at checkout and in your plan terms.

5A. CLIENTS YOU HAD BEFORE THE PLATFORM
If you already had a business relationship with a client **before** you created an account on the Platform, you may **continue to work with that client outside the Platform** (no requirement to route those pre-existing relationships through the website). This does not allow you to relabel new leads from the Platform as “pre-existing” to avoid fees.

5B. NEW CLIENTS FROM THE PLATFORM
For **new** clients you acquire **through the Platform**, if the **transaction is passed through the website** (or app) for payment, the applicable **platform fee and plan rules apply** to that completed, platform-processed payment, as described in your plan and these Terms.

6. NON-CIRCUMVENTION
You agree not to: solicit or accept off-platform payment for work that was **solicited or introduced through the Platform** in order to avoid applicable fees. You also agree not to misrepresent the origin of a client. **Pre-existing clients (see 5A) are an exception** for those specific relationships. Violations may result in termination of your provider account.

7. SAFETY REQUIREMENTS
You must: follow safety standards; disclose risks where relevant; refuse unsafe work conditions.

7A. CLIENT ID IMAGES
When a Client uploads an ID for booking verification, you may view that image **only for identity verification** in connection with that Client’s booking. You must not copy, retain for unrelated use, or share ID images outside what is needed to confirm the person at the service.

8. YOUR LIABILITY
You are responsible for: service quality; damages caused during your services; compliance with laws and regulations.

9. ACCEPTANCE
By continuing, you confirm that you have read and accepted these Professional Service Provider Terms.
`.trim();

export const TERMS_FULL_SECTIONS = [
  {
    title: "TERMS OF SERVICE",
    body: `Last updated: ${LAST_UPDATED}\n\nBooking Support\n\nRebooking assistance\nIf an issue occurs, we may help facilitate rebooking with another professional.\n\nResolution support\nWe aim to assist in resolving issues, but services are performed by independent professionals.\n\nReplacement professional\nWhere appropriate, we may help connect you with another provider.`,
  },
  {
    title: "1. INTRODUCTION",
    body: `These Terms of Service (“Terms”) govern the use of the platform operated by ${COMPANY_NAME} (“Platform,” “we,” “us,” or “our”). The Platform connects clients seeking services (“Clients”) with independent professionals (“Service Providers”). By using the Platform, you agree to these Terms.`,
  },
  {
    title: "2. PLATFORM ROLE",
    body: `The Platform acts solely as an intermediary facilitating connections between Clients and Service Providers. The Platform does not perform services, supervise services, or guarantee results. Service Providers are independent contractors and are not employees, agents, or partners of the Platform.`,
  },
  {
    title: "3. NO WARRANTY",
    body: `The Platform makes no warranties or guarantees regarding the quality, safety, legality, suitability, or outcome of services provided by Service Providers. Any verification conducted by the Platform is limited and does not guarantee qualifications, licensing, or background checks.`,
  },
  {
    title: "4. USER ACCOUNTS",
    body: `Users must be at least 18 years old, provide accurate information, and maintain account security. The Platform may suspend or terminate accounts at its sole discretion.`,
  },
  {
    title: "5. USER RESPONSIBILITIES",
    body: `Clients agree to provide accurate service details, ensure safe working conditions, and comply with all applicable laws. Service Providers agree to provide accurate information and perform services lawfully and professionally.`,
  },
  {
    title: "6. REQUESTING QUOTES",
    body: `Users may request quotes without creating an account. Booking or confirming services may require account creation and acceptance of these Terms.`,
  },
  {
    title: "7. BOOKINGS",
    body: `When a booking is confirmed, a separate service agreement is formed directly between the Client and the Service Provider. The Platform facilitates scheduling and payment processing.`,
  },
  {
    title: "7A. BOOKING IDENTITY VERIFICATION",
    body: `Clients may be asked to upload a government-issued ID image for booking verification. That image is stored securely and may be shown to the Service Provider assigned to the booking **only for the purpose of verifying identity** in connection with that booking. Service Providers must not use ID images for any other purpose, copy them for unrelated use, or share them with third parties. The Platform does not guarantee that an ID is valid or current; verification is limited to facilitating trust for scheduled services.`,
  },
  {
    title: "8. PAYMENTS",
    body: `Payments may be processed through third-party providers. The Platform may collect payments on behalf of Service Providers, deduct service fees or commissions, and hold funds until services are completed. Service Providers agree not to request or accept off-platform payments for services initiated through the Platform, subject to the “pre-existing clients” exception in Section 8A.`,
  },
  {
    title: "8A. PRE-EXISTING CLIENTS, NEW PLATFORM CLIENTS, AND FEES (SERVICE PROVIDERS)",
    body: `If a Service Provider had an existing business relationship with a client before creating an account on the Platform, the Service Provider may continue to service that pre-existing client outside the Platform. The Platform does not require those **pre-existing** relationships to be run or paid through the website. In contrast, for **new** clients the Service Provider acquires through the Platform, when a **transaction is completed and payment is processed through the website** (or the app), applicable **subscription plan rules** and **platform fees** apply—including, for **Starter, Growth, and Pro** paid plans, the **five percent (5%) fee on completed transactions** processed through the Platform—unless stated otherwise at the time of checkout or plan change. The Platform may update fee descriptions in plan pages; conflicting older copies are superseded by the Terms and the checkout summary.`,
  },
  {
    title: "9. NON-CIRCUMVENTION",
    body: `Users agree not to bypass the Platform for payments or bookings that were initiated or introduced through the Platform in order to avoid fees that would otherwise apply. Users agree not to misrepresent whether a client was introduced through the Platform. Pre-existing client relationships described in Section 8A are excepted for those specific relationships. Violations may result in account suspension or termination.`,
  },
  {
    title: "10. CANCELLATION POLICY",
    body: `Cancellations are subject to the terms presented at the time of booking. Late cancellations or missed appointments may result in fees.`,
  },
  {
    title: "11. REFUNDS & DISPUTES",
    body: `Refunds are not guaranteed and are assessed on a case-by-case basis. The Platform may, at its sole discretion, issue full or partial refunds, facilitate rebooking, or deny refund requests. Users agree to attempt to resolve disputes through the Platform before initiating external claims.`,
  },
  {
    title: "12. CHARGEBACKS",
    body: `Users agree not to initiate chargebacks without first attempting resolution through the Platform. Unauthorized chargebacks may result in account suspension or permanent removal.`,
  },
  {
    title: "13. REVIEWS AND RATINGS",
    body: `Clients may submit reviews based on genuine experiences. The Platform may remove reviews that are abusive, fraudulent, misleading, or unrelated.`,
  },
  {
    title: "14. PROPERTY DAMAGE",
    body: `Service Providers are responsible for damages caused during services. Service Providers are encouraged to maintain appropriate liability insurance. The Platform may assist in dispute resolution but is not responsible for damages.`,
  },
  {
    title: "15. PERSONAL INJURY",
    body: `The Platform is not responsible for injuries resulting from services performed by Service Providers. Liability depends on the circumstances and remains between the involved parties.`,
  },
  {
    title: "16. PET SERVICES",
    body: `Clients must disclose relevant information including aggression, medical conditions, and behavioral issues. Service Providers must treat animals humanely and responsibly.`,
  },
  {
    title: "17. COMMUNICATIONS",
    body: `All communications and transactions related to services initiated through the Platform must remain on the Platform.`,
  },
  {
    title: "18. DATA AND PRIVACY",
    body: `By using the Platform, users consent to the collection and use of personal data for service facilitation, communication, and platform improvement. All data is handled in accordance with the Platform’s Privacy Policy. Government ID images uploaded for booking verification are disclosed to assigned Service Providers **only for identity verification** as described in Section 7A, and are not used for marketing or unrelated profiling.`,
  },
  {
    title: "19. ACCOUNT TERMINATION",
    body: `The Platform may suspend or terminate accounts for fraud, harassment, unsafe behavior, or violation of these Terms.`,
  },
  {
    title: "20. FORCE MAJEURE",
    body: `The Platform is not liable for delays or failures caused by events beyond its control, including but not limited to natural disasters, weather conditions, technical failures, or emergencies.`,
  },
  {
    title: "21. LIMITATION OF LIABILITY",
    body: `To the maximum extent permitted by law, the Platform is not liable for indirect or incidental damages, loss of profits, service provider actions or omissions, or damages arising from service performance.`,
  },
  {
    title: "22. MODIFICATIONS",
    body: `The Platform may update these Terms at any time. Continued use of the Platform constitutes acceptance of the updated Terms.`,
  },
  {
    title: "23. GOVERNING LAW",
    body: `These Terms are governed by the laws of Québec and applicable Canadian law.`,
  },
];

export const TERMS_PROVIDER_AGREEMENT = [
  {
    title: "PROFESSIONAL SERVICE PROVIDER AGREEMENT",
    body: `Service Providers are independent professionals who use the Platform to connect with Clients. This Agreement applies in addition to the Platform Terms of Service.`,
  },
  {
    title: "1. INDEPENDENT CONTRACTOR STATUS",
    body: `Service Providers are independent contractors and not employees of the Platform.`,
  },
  {
    title: "2. ELIGIBILITY",
    body: `Service Providers must be legally authorized to operate, hold required licenses where applicable, and comply with all laws and regulations.`,
  },
  {
    title: "3. PROFESSIONAL STANDARDS",
    body: `Service Providers must perform services competently, act professionally, and respect client property.`,
  },
  {
    title: "4. INSURANCE",
    body: `Service Providers are responsible for maintaining appropriate insurance where required.`,
  },
  {
    title: "5. PRICING",
    body: `Service Providers set their own pricing unless otherwise agreed. The Platform may charge subscription fees, commissions, or other fees as described in your plan and at checkout.`,
  },
  {
    title: "6. PAYOUTS",
    body: `Payments collected through the Platform will be distributed according to payout schedules, minus applicable fees.`,
  },
  {
    title: "6A. PLATFORM FEES ON PLATFORM-PROCESSED WORK",
    body: `For **Starter, Growth, and Pro** subscription tiers (and as otherwise stated at checkout), the Platform may retain a percentage (for example **five percent (5%)**) of **completed** transactions that are **paid through the Platform**. Pre-existing clients (relationships that existed before you joined the Platform) may continue outside the Platform as described in the Terms of Service. **New clients acquired through the Platform** must use the Platform’s payment flow when charging through the Platform for those engagements, and the applicable fee applies to qualifying completed transactions.`,
  },
  {
    title: "7. NON-CIRCUMVENTION",
    body: `Service Providers agree not to redirect clients introduced through the Platform off-platform to avoid fees that apply under these Terms and your plan. Service Providers may continue pre-existing relationships outside the Platform as described in the Terms of Service.`,
  },
  {
    title: "8. SAFETY REQUIREMENTS",
    body: `Service Providers must follow safety standards, refuse unsafe work, and disclose risks to clients.`,
  },
  {
    title: "9. PROVIDER LIABILITY",
    body: `Service Providers are solely responsible for service quality, damages caused, and legal compliance.`,
  },
  {
    title: "10. PLATFORM RIGHTS",
    body: `The Platform reserves the right to remove listings, suspend accounts, or modify the visibility of profiles.`,
  },
  {
    title: "GOVERNING LAW",
    body: `This Professional Service Provider Agreement is governed by the laws of Québec and applicable Canadian law.`,
  },
];

export const TERMS_FULL_SECTIONS_FR = [
  {
    title: "CONDITIONS D'UTILISATION",
    body: `Dernière mise à jour : ${LAST_UPDATED_FR}\n\nSoutien aux réservations\n\nAide à la nouvelle réservation\nEn cas de problème, nous pouvons aider à faciliter une nouvelle réservation avec un autre professionnel.\n\nSoutien à la résolution\nNous visons à aider à résoudre les problèmes, mais les services sont exécutés par des professionnels indépendants.\n\nProfessionnel de remplacement\nLorsque cela est approprié, nous pouvons aider à vous mettre en relation avec un autre fournisseur.`,
  },
  {
    title: "1. INTRODUCTION",
    body: `Les présentes Conditions d'utilisation (« Conditions ») régissent l'utilisation de la plateforme exploitée par ${COMPANY_NAME} (« Plateforme », « nous », « notre » ou « nos »). La Plateforme met en relation des clients recherchant des services (« Clients ») avec des professionnels indépendants (« Fournisseurs de services »). En utilisant la Plateforme, vous acceptez les présentes Conditions.`,
  },
  {
    title: "2. RÔLE DE LA PLATEFORME",
    body: `La Plateforme agit uniquement comme intermédiaire afin de faciliter les mises en relation entre les Clients et les Fournisseurs de services. La Plateforme n'exécute pas les services, ne supervise pas les services et ne garantit pas les résultats. Les Fournisseurs de services sont des entrepreneurs indépendants et ne sont pas des employés, agents ou partenaires de la Plateforme.`,
  },
  {
    title: "3. AUCUNE GARANTIE",
    body: `La Plateforme ne donne aucune garantie concernant la qualité, la sécurité, la légalité, la pertinence ou le résultat des services fournis par les Fournisseurs de services. Toute vérification effectuée par la Plateforme est limitée et ne garantit pas les qualifications, les permis, les licences ou les vérifications d'antécédents.`,
  },
  {
    title: "4. COMPTES UTILISATEURS",
    body: `Les utilisateurs doivent avoir au moins 18 ans, fournir des renseignements exacts et maintenir la sécurité de leur compte. La Plateforme peut suspendre ou résilier des comptes à sa seule discrétion.`,
  },
  {
    title: "5. RESPONSABILITÉS DES UTILISATEURS",
    body: `Les Clients acceptent de fournir des détails exacts sur les services demandés, d'assurer des conditions de travail sécuritaires et de respecter toutes les lois applicables. Les Fournisseurs de services acceptent de fournir des renseignements exacts et d'exécuter leurs services légalement et professionnellement.`,
  },
  {
    title: "6. DEMANDE DE SOUMISSIONS",
    body: `Les utilisateurs peuvent demander des soumissions sans créer de compte. La réservation ou la confirmation de services peut nécessiter la création d'un compte et l'acceptation des présentes Conditions.`,
  },
  {
    title: "7. RÉSERVATIONS",
    body: `Lorsqu'une réservation est confirmée, une entente de service distincte est formée directement entre le Client et le Fournisseur de services. La Plateforme facilite la planification et le traitement des paiements.`,
  },
  {
    title: "7A. VÉRIFICATION D'IDENTITÉ (RÉSERVATIONS)",
    body: `Les Clients peuvent être invités à téléverser une image d'une pièce d'identité officielle pour la vérification d'une réservation. Cette image est conservée de façon sécurisée et peut être montrée au Fournisseur de services assigné à la réservation **uniquement aux fins de vérifier l'identité** dans le cadre de cette réservation. Les Fournisseurs de services ne doivent pas utiliser ces images à d'autres fins, les copier pour un usage non lié, ni les communiquer à des tiers. La Plateforme ne garantit pas qu'une pièce d'identité est valide ou à jour; la vérification vise seulement à faciliter la confiance pour les services planifiés.`,
  },
  {
    title: "8. PAIEMENTS",
    body: `Les paiements peuvent être traités par des fournisseurs tiers. La Plateforme peut percevoir des paiements au nom des Fournisseurs de services, déduire des frais de service ou commissions, et retenir les fonds jusqu'à l'achèvement des services. Les Fournisseurs de services acceptent de ne pas demander ni accepter de paiements hors plateforme pour des services initiés par l'intermédiaire de la Plateforme, sous réserve de l'exception relative aux « clients préexistants » prévue à l'article 8A.`,
  },
  {
    title: "8A. CLIENTS PRÉEXISTANTS, NOUVEAUX CLIENTS DE LA PLATEFORME ET FRAIS (FOURNISSEURS DE SERVICES)",
    body: `Si un Fournisseur de services avait déjà une relation d'affaires avec un client avant de créer un compte sur la Plateforme, il peut continuer à servir ce client préexistant en dehors de la Plateforme. La Plateforme n'exige pas que ces relations **préexistantes** passent par le site Web ni y soient payées. En revanche, pour les **nouveaux** clients acquis par l'intermédiaire de la Plateforme, lorsqu'une **transaction est complétée et que le paiement est traité sur le site Web** (ou dans l'application), les règles du **plan d'abonnement** et les **frais de plateforme** applicables s'appliquent, y compris, pour les plans payants admissibles comme Croissance et Performance, les **frais de cinq pour cent (5 %) sur les transactions complétées** traitées par la Plateforme, sauf indication contraire au moment du paiement ou du changement de plan. Les règles du forfait Essentiel sont celles publiées sur la Plateforme. La Plateforme peut mettre à jour les descriptions des frais sur les pages de plans; les copies plus anciennes incompatibles sont remplacées par les présentes Conditions et le résumé affiché au paiement.`,
  },
  {
    title: "9. NON-CONTOURNEMENT",
    body: `Les utilisateurs acceptent de ne pas contourner la Plateforme pour les paiements ou les réservations initiés ou présentés par l'intermédiaire de la Plateforme afin d'éviter des frais autrement applicables. Les utilisateurs acceptent de ne pas déformer l'origine d'un client. Les relations avec des clients préexistants décrites à l'article 8A sont exclues pour ces relations précises. Les violations peuvent entraîner la suspension ou la résiliation du compte.`,
  },
  {
    title: "10. POLITIQUE D'ANNULATION",
    body: `Les annulations sont soumises aux conditions présentées au moment de la réservation. Les annulations tardives ou les rendez-vous manqués peuvent entraîner des frais.`,
  },
  {
    title: "11. REMBOURSEMENTS ET DIFFÉRENDS",
    body: `Les remboursements ne sont pas garantis et sont évalués au cas par cas. La Plateforme peut, à sa seule discrétion, émettre un remboursement total ou partiel, faciliter une nouvelle réservation ou refuser une demande de remboursement. Les utilisateurs acceptent de tenter de résoudre les différends par l'intermédiaire de la Plateforme avant d'entamer des réclamations externes.`,
  },
  {
    title: "12. RÉTROFACTURATIONS",
    body: `Les utilisateurs acceptent de ne pas initier de rétrofacturation sans avoir d'abord tenté une résolution par l'intermédiaire de la Plateforme. Les rétrofacturations non autorisées peuvent entraîner la suspension du compte ou le retrait permanent.`,
  },
  {
    title: "13. AVIS ET ÉVALUATIONS",
    body: `Les Clients peuvent soumettre des avis basés sur des expériences réelles. La Plateforme peut retirer les avis abusifs, frauduleux, trompeurs ou non pertinents.`,
  },
  {
    title: "14. DOMMAGES MATÉRIELS",
    body: `Les Fournisseurs de services sont responsables des dommages causés pendant les services. Les Fournisseurs de services sont encouragés à maintenir une assurance responsabilité appropriée. La Plateforme peut aider à la résolution des différends, mais elle n'est pas responsable des dommages.`,
  },
  {
    title: "15. BLESSURES CORPORELLES",
    body: `La Plateforme n'est pas responsable des blessures résultant de services exécutés par des Fournisseurs de services. La responsabilité dépend des circonstances et demeure entre les parties concernées.`,
  },
  {
    title: "16. SERVICES POUR ANIMAUX",
    body: `Les Clients doivent divulguer les renseignements pertinents, notamment l'agressivité, les problèmes médicaux et les troubles de comportement. Les Fournisseurs de services doivent traiter les animaux de manière humaine et responsable.`,
  },
  {
    title: "17. COMMUNICATIONS",
    body: `Toutes les communications et transactions liées aux services initiés par l'intermédiaire de la Plateforme doivent demeurer sur la Plateforme.`,
  },
  {
    title: "18. DONNÉES ET CONFIDENTIALITÉ",
    body: `En utilisant la Plateforme, les utilisateurs consentent à la collecte et à l'utilisation de leurs données personnelles pour faciliter les services, les communications et l'amélioration de la Plateforme. Toutes les données sont traitées conformément à la Politique de confidentialité de la Plateforme. Les images de pièces d'identité téléversées pour la vérification d'une réservation sont communiquées aux Fournisseurs de services assignés **uniquement pour la vérification d'identité**, comme décrit à l'article 7A, et ne sont pas utilisées à des fins de marketing ou de profilage non lié.`,
  },
  {
    title: "19. RÉSILIATION DE COMPTE",
    body: `La Plateforme peut suspendre ou résilier des comptes en cas de fraude, de harcèlement, de comportement dangereux ou de violation des présentes Conditions.`,
  },
  {
    title: "20. FORCE MAJEURE",
    body: `La Plateforme n'est pas responsable des retards ou défauts d'exécution causés par des événements hors de son contrôle, y compris notamment les catastrophes naturelles, les conditions météorologiques, les pannes techniques ou les urgences.`,
  },
  {
    title: "21. LIMITATION DE RESPONSABILITÉ",
    body: `Dans la mesure maximale permise par la loi, la Plateforme n'est pas responsable des dommages indirects ou accessoires, des pertes de profits, des actions ou omissions des Fournisseurs de services, ni des dommages découlant de l'exécution des services.`,
  },
  {
    title: "22. MODIFICATIONS",
    body: `La Plateforme peut mettre à jour les présentes Conditions à tout moment. L'utilisation continue de la Plateforme constitue l'acceptation des Conditions mises à jour.`,
  },
  {
    title: "23. DROIT APPLICABLE",
    body: `Les présentes Conditions sont régies par les lois du Québec et le droit canadien applicable.`,
  },
];

export const TERMS_PROVIDER_AGREEMENT_FR = [
  {
    title: "ENTENTE DES FOURNISSEURS DE SERVICES PROFESSIONNELS",
    body: `Les Fournisseurs de services sont des professionnels indépendants qui utilisent la Plateforme pour entrer en relation avec des Clients. La présente Entente s'applique en plus des Conditions d'utilisation de la Plateforme.`,
  },
  {
    title: "1. STATUT D'ENTREPRENEUR INDÉPENDANT",
    body: `Les Fournisseurs de services sont des entrepreneurs indépendants et ne sont pas des employés de la Plateforme.`,
  },
  {
    title: "2. ADMISSIBILITÉ",
    body: `Les Fournisseurs de services doivent être légalement autorisés à exercer leurs activités, détenir les permis ou licences requis le cas échéant, et respecter toutes les lois et réglementations applicables.`,
  },
  {
    title: "3. NORMES PROFESSIONNELLES",
    body: `Les Fournisseurs de services doivent exécuter les services avec compétence, agir professionnellement et respecter la propriété des clients.`,
  },
  {
    title: "4. ASSURANCE",
    body: `Les Fournisseurs de services sont responsables de maintenir une assurance appropriée lorsque cela est requis.`,
  },
  {
    title: "5. TARIFICATION",
    body: `Les Fournisseurs de services fixent leurs propres prix, sauf entente contraire. La Plateforme peut facturer des frais d'abonnement, des commissions ou d'autres frais comme décrit dans votre plan et au moment du paiement.`,
  },
  {
    title: "6. VERSEMENTS",
    body: `Les paiements perçus par l'intermédiaire de la Plateforme seront distribués selon les calendriers de versement, moins les frais applicables.`,
  },
  {
    title: "6A. FRAIS DE PLATEFORME SUR LE TRAVAIL PAYÉ PAR LA PLATEFORME",
    body: `Pour les plans d'abonnement Croissance et Performance (et tel qu'indiqué autrement au moment du paiement), la Plateforme peut retenir un pourcentage (par exemple **cinq pour cent (5 %)**) des transactions **complétées** qui sont **payées par l'intermédiaire de la Plateforme**. Les clients préexistants (relations qui existaient avant votre adhésion à la Plateforme) peuvent continuer en dehors de la Plateforme comme décrit dans les Conditions d'utilisation. Les **nouveaux clients acquis par l'intermédiaire de la Plateforme** doivent utiliser le flux de paiement de la Plateforme lorsque la facturation passe par la Plateforme pour ces mandats, et les frais applicables s'appliquent aux transactions complétées admissibles.`,
  },
  {
    title: "7. NON-CONTOURNEMENT",
    body: `Les Fournisseurs de services acceptent de ne pas rediriger hors plateforme des clients présentés par la Plateforme afin d'éviter les frais applicables en vertu des présentes Conditions et de leur plan. Les Fournisseurs de services peuvent continuer les relations préexistantes en dehors de la Plateforme comme décrit dans les Conditions d'utilisation.`,
  },
  {
    title: "8. EXIGENCES DE SÉCURITÉ",
    body: `Les Fournisseurs de services doivent respecter les normes de sécurité, refuser les travaux dangereux et divulguer les risques aux clients.`,
  },
  {
    title: "9. RESPONSABILITÉ DU FOURNISSEUR",
    body: `Les Fournisseurs de services sont seuls responsables de la qualité du service, des dommages causés et du respect des lois.`,
  },
  {
    title: "10. DROITS DE LA PLATEFORME",
    body: `La Plateforme se réserve le droit de retirer des annonces, de suspendre des comptes ou de modifier la visibilité des profils.`,
  },
  {
    title: "DROIT APPLICABLE",
    body: `La présente Entente des Fournisseurs de services professionnels est régie par les lois du Québec et le droit canadien applicable.`,
  },
];

export { LAST_UPDATED, LAST_UPDATED_FR, COMPANY_NAME };

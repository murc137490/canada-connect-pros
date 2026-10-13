/** Segmented first-time dashboard tutorial (pro-focused). Stored per user in localStorage. */

export type DashTourSegment = "account" | "pro" | "bookings" | "favorites" | "reviews" | "invoices";

export const DASH_TOUR_SEGMENTS: DashTourSegment[] = [
  "account",
  "pro",
  "bookings",
  "favorites",
  "reviews",
  "invoices",
];

export const DASH_TOUR_TAB: Record<DashTourSegment, string> = {
  account: "account",
  pro: "pro",
  bookings: "bookings",
  reviews: "reviews",
  invoices: "invoices",
};

type TourState = {
  completed: Partial<Record<DashTourSegment, boolean>>;
  /** When set, auto-start is off for every segment (Help / ?tour=1 can still force). */
  autoSuppressedAt?: string;
  dismissedAllAt?: string;
};

function storageKey(userId: string) {
  return `altshift:dash-tour:v2:${userId}`;
}

function readState(userId: string): TourState {
  if (!userId || typeof window === "undefined") return { completed: {} };
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { completed: {} };
    const parsed = JSON.parse(raw) as TourState;
    return {
      completed: parsed.completed ?? {},
      autoSuppressedAt: parsed.autoSuppressedAt,
      dismissedAllAt: parsed.dismissedAllAt,
    };
  } catch {
    return { completed: {} };
  }
}

function writeState(userId: string, state: TourState) {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

/** True when this segment should not auto-open (completed or whole-tour suppressed). */
export function shouldAutoStartSegment(userId: string, segment: DashTourSegment): boolean {
  if (!userId) return false;
  const state = readState(userId);
  if (state.autoSuppressedAt) return false;
  if (state.completed[segment] === true) return false;
  return true;
}

export function isSegmentCompleted(userId: string, segment: DashTourSegment): boolean {
  const state = readState(userId);
  return state.completed[segment] === true || Boolean(state.autoSuppressedAt);
}

export function areAllSegmentsCompleted(userId: string): boolean {
  const state = readState(userId);
  if (state.autoSuppressedAt) return true;
  return DASH_TOUR_SEGMENTS.every((s) => state.completed[s] === true);
}

export function markSegmentCompleted(userId: string, segment: DashTourSegment) {
  const state = readState(userId);
  state.completed[segment] = true;
  if (DASH_TOUR_SEGMENTS.every((s) => state.completed[s] === true)) {
    state.dismissedAllAt = new Date().toISOString();
    state.autoSuppressedAt = state.autoSuppressedAt ?? state.dismissedAllAt;
  }
  writeState(userId, state);
}

/** Persist that auto-tour should not run again (any dismiss / first auto-open). */
export function suppressAutoTour(userId: string, segment?: DashTourSegment) {
  const state = readState(userId);
  const now = new Date().toISOString();
  state.autoSuppressedAt = state.autoSuppressedAt ?? now;
  if (segment) state.completed[segment] = true;
  writeState(userId, state);
}

export function markAllSegmentsCompleted(userId: string) {
  const state = readState(userId);
  const now = new Date().toISOString();
  for (const s of DASH_TOUR_SEGMENTS) state.completed[s] = true;
  state.dismissedAllAt = now;
  state.autoSuppressedAt = state.autoSuppressedAt ?? now;
  writeState(userId, state);
}

export function resetSegment(userId: string, segment: DashTourSegment) {
  const state = readState(userId);
  state.completed[segment] = false;
  delete state.dismissedAllAt;
  // Keep autoSuppressedAt so reset-for-replay via Help still needs ?tour=1 / force;
  // clear suppress only when explicitly replaying all.
  writeState(userId, state);
}

export function resetAllSegments(userId: string) {
  writeState(userId, { completed: {} });
}

/** Clear suppress so a forced replay can be followed by normal per-segment completion again. */
export function clearAutoTourSuppress(userId: string) {
  const state = readState(userId);
  delete state.autoSuppressedAt;
  writeState(userId, state);
}

/** Map dashboard tab query to a tour segment (if any). */
export function segmentForTab(tab: string | null | undefined): DashTourSegment | null {
  const t = (tab ?? "account").toLowerCase();
  if (t === "account") return "account";
  if (t === "pro") return "pro";
  if (t === "bookings") return "bookings";
  if (t === "favorites") return "favorites";
  if (t === "reviews") return "reviews";
  if (t === "invoices") return "invoices";
  return null;
}

export type TourStep = {
  target: string;
  titleEn: string;
  titleFr: string;
  bodyEn: string;
  bodyFr: string;
};

export const TOUR_STEPS: Record<DashTourSegment, TourStep[]> = {
  account: [
    {
      target: "[data-tour='account-identifiers']",
      titleEn: "Member ID, username & public link",
      titleFr: "Numéro de membre, nom d’utilisateur et lien public",
      bodyEn:
        "Your phone number identifies the same account in client and pro mode. Your Member ID is also a sign-in option. A username can be used to sign in and forms your public link. If you change it, the old link redirects and stays reserved for 90 days. Your Voice PIN protects Front Desk calls; the PIN itself is never displayed.",
      bodyFr:
        "Votre numéro de téléphone identifie le même compte en mode client et professionnel. Le numéro de membre permet aussi de se connecter. Votre nom d’utilisateur sert à vous connecter et forme votre lien public. Si vous le changez, l’ancien lien redirige vers le nouveau et reste réservé pendant 90 jours. Votre NIP vocal protège les appels au service téléphonique; les chiffres ne sont jamais affichés.",
    },
    {
      target: "[data-tour='account-profile']",
      titleEn: "My account",
      titleFr: "Mon compte",
      bodyEn:
        "Update your name, phone, Québec postal code, invoice address, email language, birthday, and main service category. These details are used for bookings, receipts, and your account profile.",
      bodyFr:
        "Mettez à jour votre nom, téléphone, code postal du Québec, adresse de facturation, langue des courriels, date de naissance et catégorie principale. Ces renseignements servent aux réservations, aux reçus et à votre compte.",
    },
    {
      target: "[data-tour='account-cancel-policy']",
      titleEn: "Cancellation policy",
      titleFr: "Politique d’annulation",
      bodyEn:
        "As a pro, set free cancellation, a late fee (fixed or %), or no cancellation per service when you edit each service on the Pro tab.",
      bodyFr:
        "En tant que pro, définissez l’annulation gratuite, des frais (fixe ou %) ou aucune annulation par service dans l’onglet Pro.",
    },
    {
      target: "[data-tour='account-id-verification']",
      titleEn: "Booking ID verification",
      titleFr: "Vérification d’identité",
      bodyEn:
        "You may upload a government ID for booking verification. Retention details are subject to legal review, AltShift stores it securely for platform checks.",
      bodyFr:
        "Vous pouvez téléverser une pièce d’identité pour la vérification. La conservation est sujette à révision juridique, AltShift la garde de façon sécurisée.",
    },
    {
      target: "[data-tour='account-plan']",
      titleEn: "Plan & Booking Credits",
      titleFr: "Forfait et crédits de réservation",
      bodyEn:
        "Paid plans renew monthly from their billing date, and you can change plans anytime. The plan card lists the included tools and monthly Booking Credits. Credits are used for eligible bookings, not for posting a request or receiving a quote.",
      bodyFr:
        "Les forfaits payants se renouvellent chaque mois à partir de leur date de facturation et vous pouvez les changer en tout temps. La carte présente les outils inclus et les crédits de réservation mensuels. Les crédits servent aux réservations admissibles, pas à la publication d’une demande ni à la réception d’un devis.",
    },
    {
      target: "[data-tour='available-jobs']",
      titleEn: "Available jobs near you",
      titleFr: "Travaux disponibles près de vous",
      bodyEn:
        "Open leads near you show up here. Browse and take jobs that fit your radius and availability.",
      bodyFr:
        "Les demandes ouvertes près de vous apparaissent ici. Parcourez et prenez les jobs qui correspondent à votre rayon et vos disponibilités.",
    },
  ],
  pro: [
    {
      target: "[data-tour='pro-avatar-square']",
      titleEn: "Photo & Square",
      titleFr: "Photo et Square",
      bodyEn: "Add a personal photo. When Square is connected, the check above your name opens your Square dashboard.",
      bodyFr: "Ajoutez une photo. Quand Square est relié, la coche au-dessus de votre nom ouvre votre tableau de bord Square.",
    },
    {
      target: "[data-tour='pro-stats']",
      titleEn: "Your pro stats",
      titleFr: "Vos statistiques",
      bodyEn: "Leads, profile views, reviews, and ranking help you see how clients discover you.",
      bodyFr: "Les demandes, vues du profil, avis et classement montrent comment les clients vous trouvent.",
    },
    {
      target: "[data-tour='pro-featured']",
      titleEn: "Featured profile design",
      titleFr: "Apparence du profil",
      bodyEn: "Choose colors and template so your public page matches your brand.",
      bodyFr: "Choisissez couleurs et modèle pour votre page publique.",
    },
    {
      target: "[data-tour='pro-services']",
      titleEn: "Services",
      titleFr: "Services",
      bodyEn: "Add each service with duration, price, and optional cancellation rules. Clients see these on your page.",
      bodyFr: "Ajoutez chaque service avec durée, prix et annulation. Les clients les voient sur votre page.",
    },
    {
      target: "[data-tour='pro-portfolio']",
      titleEn: "Portfolio",
      titleFr: "Portfolio",
      bodyEn: "Upload work photos clients see on your public profile, show your craftsmanship.",
      bodyFr: "Téléversez des photos de travaux visibles sur votre profil public.",
    },
  ],
  bookings: [
    {
      target: "[data-tour='schedule-calendar']",
      titleEn: "Schedule & availability",
      titleFr: "Horaire et disponibilités",
      bodyEn:
        "Use the calendar and weekly template to set when you’re open. Click a day for full-day off or blocked hours, then save. Starter plans only open a rolling 30-day window.",
      bodyFr:
        "Utilisez le calendrier et le modèle hebdomadaire pour vos disponibilités. Cliquez un jour pour une journée complète ou des plages bloquées, puis enregistrez. Essentiel = fenêtre glissante de 30 jours.",
    },
    {
      target: "[data-tour='booking-pro-tools']",
      titleEn: "Texts, client history & repeat bookings",
      titleFr: "Textos, historique client et réservations répétées",
      bodyEn:
        "SMS automation depends on your plan. Growth tools include private client notes, optional rebooking reminders, and repeat bookings. Reminder rules prevent messages when a client already has an upcoming booking or opted out. Repeat visits are scheduled as normal bookings and can be paused or cancelled.",
      bodyFr:
        "L’automatisation par texto dépend de votre forfait. Les outils Croissance comprennent des notes privées sur les clients, des rappels de nouvelle réservation facultatifs et les réservations répétées. Les rappels ne sont pas envoyés si un client a déjà une réservation à venir ou s’est désabonné. Les visites répétées sont planifiées comme des réservations normales et peuvent être mises en pause ou annulées.",
    },
    {
      target: "[data-tour='received-quotes']",
      titleEn: "Your requests & quotes",
      titleFr: "Vos demandes et devis",
      bodyEn:
        "Requests you posted appear here with the number of quotes received. Open a request to compare professional responses and decide whether to continue.",
      bodyFr:
        "Les demandes que vous avez publiées apparaissent ici avec le nombre de devis reçus. Ouvrez une demande pour comparer les réponses des professionnels et décider de la suite.",
    },
    {
      target: "[data-tour='booking-requests']",
      titleEn: "Booking requests",
      titleFr: "Demandes de réservation",
      bodyEn:
        "New client requests appear here. Review the requested service and schedule, then accept or decline. When a job is completed, upload the requested proof photos if prompted.",
      bodyFr:
        "Les nouvelles demandes des clients apparaissent ici. Vérifiez le service demandé et l’horaire, puis acceptez ou refusez. À la fin d’un travail, téléversez les photos de preuve demandées si l’application vous le propose.",
    },
  ],
  favorites: [
    {
      target: "[data-tour='favorites-panel']",
      titleEn: "Saved pros",
      titleFr: "Professionnels enregistrés",
      bodyEn:
        "Keep professionals you may want to book later in one place. Open a profile to review its services, availability, and booking options, or remove a pro from this list.",
      bodyFr:
        "Gardez au même endroit les professionnels que vous pourriez réserver plus tard. Ouvrez un profil pour consulter ses services, ses disponibilités et les options de réservation, ou retirez-le de la liste.",
    },
  ],
  reviews: [
    {
      target: "[data-tour='reviews-panel']",
      titleEn: "Reviews",
      titleFr: "Avis",
      bodyEn:
        "Review panels separate feedback you received, feedback from professionals, and reviews you wrote. Other people’s review text stays locked until you leave your own review; ratings stay hidden while a review is locked.",
      bodyFr:
        "Les sections séparent les avis reçus, ceux des professionnels et ceux que vous avez rédigés. Le texte des autres avis reste verrouillé jusqu’à ce que vous laissiez le vôtre; les notes restent masquées pendant le verrouillage.",
    },
  ],
  invoices: [
    {
      target: "[data-tour='invoices-panel']",
      titleEn: "Invoices",
      titleFr: "Factures",
      bodyEn:
        "Paid booking receipts appear here with the service amount, platform fee, and taxes. Pin a receipt to move it into the right-hand column; use the left column for the rest. If no receipt is listed yet, this tab will fill in after your first paid booking.",
      bodyFr:
        "Les reçus des réservations payées apparaissent ici avec le montant du service, les frais de plateforme et les taxes. Épinglez un reçu pour le déplacer dans la colonne de droite; les autres restent à gauche. Si aucun reçu n’est encore affiché, cet onglet se remplira après votre première réservation payée.",
    },
  ],
};

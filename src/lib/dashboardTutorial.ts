/** Segmented first-time dashboard tutorial (pro-focused). Stored per user in localStorage. */

export type DashTourSegment = "account" | "pro" | "bookings" | "reviews" | "invoices";

export const DASH_TOUR_SEGMENTS: DashTourSegment[] = [
  "account",
  "pro",
  "bookings",
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
  dismissedAllAt?: string;
};

function storageKey(userId: string) {
  return `premiere:dash-tour:${userId}`;
}

function readState(userId: string): TourState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { completed: {} };
    const parsed = JSON.parse(raw) as TourState;
    return {
      completed: parsed.completed ?? {},
      dismissedAllAt: parsed.dismissedAllAt,
    };
  } catch {
    return { completed: {} };
  }
}

function writeState(userId: string, state: TourState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function isSegmentCompleted(userId: string, segment: DashTourSegment): boolean {
  return readState(userId).completed[segment] === true;
}

export function areAllSegmentsCompleted(userId: string): boolean {
  const state = readState(userId);
  return DASH_TOUR_SEGMENTS.every((s) => state.completed[s] === true);
}

export function markSegmentCompleted(userId: string, segment: DashTourSegment) {
  const state = readState(userId);
  state.completed[segment] = true;
  if (DASH_TOUR_SEGMENTS.every((s) => state.completed[s] === true)) {
    state.dismissedAllAt = new Date().toISOString();
  }
  writeState(userId, state);
}

export function markAllSegmentsCompleted(userId: string) {
  const state = readState(userId);
  for (const s of DASH_TOUR_SEGMENTS) state.completed[s] = true;
  state.dismissedAllAt = new Date().toISOString();
  writeState(userId, state);
}

export function resetSegment(userId: string, segment: DashTourSegment) {
  const state = readState(userId);
  state.completed[segment] = false;
  delete state.dismissedAllAt;
  writeState(userId, state);
}

export function resetAllSegments(userId: string) {
  writeState(userId, { completed: {} });
}

/** Map dashboard tab query to a tour segment (if any). */
export function segmentForTab(tab: string | null | undefined): DashTourSegment | null {
  const t = (tab ?? "account").toLowerCase();
  if (t === "account") return "account";
  if (t === "pro") return "pro";
  if (t === "bookings") return "bookings";
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
      target: "[data-tour='account-profile']",
      titleEn: "My account",
      titleFr: "Mon compte",
      bodyEn:
        "Update your name, phone, postal code, and preferred email language. This info is used for bookings and receipts.",
      bodyFr:
        "Mettez à jour votre nom, téléphone, code postal et langue de courriel. Ces infos servent aux réservations et reçus.",
    },
    {
      target: "[data-tour='account-id-verification']",
      titleEn: "Booking ID verification",
      titleFr: "Vérification d’identité",
      bodyEn:
        "You may upload a government ID for booking verification. Retention details are subject to legal review — Première stores it securely for platform checks.",
      bodyFr:
        "Vous pouvez téléverser une pièce d’identité pour la vérification. La conservation est sujette à révision juridique — Première la garde de façon sécurisée.",
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
  ],
  pro: [
    {
      target: "[data-tour='pro-stats']",
      titleEn: "Your pro stats",
      titleFr: "Vos statistiques",
      bodyEn: "Leads, profile views, reviews, and ranking help you see how clients discover you.",
      bodyFr: "Les leads, vues, avis et classement montrent comment les clients vous trouvent.",
    },
    {
      target: "[data-tour='pro-avatar-square']",
      titleEn: "Photo & Square payouts",
      titleFr: "Photo et paiements Square",
      bodyEn: "Add a personal photo and connect Square so client payments can pay out to your account.",
      bodyFr: "Ajoutez une photo et connectez Square pour recevoir les paiements clients.",
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
      bodyEn: "Upload work photos clients see on your public profile — show your craftsmanship.",
      bodyFr: "Téléversez des photos de travaux visibles sur votre profil public.",
    },
  ],
  bookings: [
    {
      target: "[data-tour='schedule-calendar']",
      titleEn: "Schedule calendar",
      titleFr: "Calendrier",
      bodyEn:
        "Click a day to toggle full-day availability or add blocked hours (From → To). Save schedule to publish. Starter plans only open a rolling 30-day window.",
      bodyFr:
        "Cliquez un jour pour bloquer la journée ou des plages (De → À). Enregistrez pour publier. Essentiel = fenêtre glissante de 30 jours.",
    },
    {
      target: "[data-tour='booking-requests']",
      titleEn: "Booking requests",
      titleFr: "Demandes de réservation",
      bodyEn:
        "Accept or deny each request. When you complete a job, upload 2–3 proof photos for your protection.",
      bodyFr:
        "Acceptez ou refusez chaque demande. À la fin d’un job, téléversez 2–3 photos de preuve pour votre protection.",
    },
  ],
  reviews: [
    {
      target: "[data-tour='reviews-panel']",
      titleEn: "Reviews",
      titleFr: "Avis",
      bodyEn:
        "Other people’s review text stays locked until you leave your own review. Stars stay hidden while a review is locked.",
      bodyFr:
        "Le texte des avis reste verrouillé jusqu’à ce que vous laissiez le vôtre. Les étoiles restent masquées tant que c’est verrouillé.",
    },
  ],
  invoices: [
    {
      target: "[data-tour='invoices-panel']",
      titleEn: "Invoices",
      titleFr: "Factures",
      bodyEn:
        "Each invoice breaks down service amount, Première’s platform fee, and applicable taxes. A sample invoice appears until you finish this tip.",
      bodyFr:
        "Chaque facture détaille le service, les frais de plateforme Première et les taxes. Un exemple s’affiche jusqu’à la fin de ce conseil.",
    },
  ],
};

/** Growth & Pro tools: shared helpers + EN/FR copy (CRM, reminders, Book Again, repeat bookings, response time). */
import type { ProPlanId } from "@/lib/proPlanPreview";

export type Lang = "en" | "fr";
export type SeriesFrequency = "weekly" | "biweekly" | "monthly";
export type SeriesStatus = "proposed" | "active" | "paused" | "cancelled";

export function hasGrowthTools(tier: ProPlanId | null | undefined): boolean {
  return tier === "growth" || tier === "pro";
}

/** Raw tier string from pro_profiles.subscription_tier (client-side views of someone else's pro). */
export function tierStringHasGrowthTools(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return t === "growth" || t === "pro";
}

/**
 * Honest public wording for a median response time. Returns null when we would rather show nothing
 * (no data, or slower than a week).
 */
export function responseTimeLabel(medianMinutes: number | null | undefined, lang: Lang): string | null {
  if (medianMinutes == null || !Number.isFinite(medianMinutes) || medianMinutes < 0) return null;
  if (medianMinutes <= 60) return lang === "fr" ? "Répond habituellement en moins d’une heure" : "Usually responds within an hour";
  const hours = Math.ceil(medianMinutes / 60);
  if (hours <= 24) return lang === "fr" ? `Répond habituellement en ${hours} h` : `Usually responds within ${hours} h`;
  const days = Math.ceil(medianMinutes / 1440);
  if (days <= 7) return lang === "fr" ? `Répond habituellement en ${days} jours` : `Usually responds within ${days} days`;
  return null;
}

export function formatMoneyCents(cents: number | null | undefined, lang: Lang): string {
  const v = typeof cents === "number" ? cents : 0;
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(v / 100);
}

export function formatYmd(ymd: string | null | undefined, lang: Lang): string {
  if (!ymd) return "—";
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(ymd);
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" });
}

export function addMonthsYmd(ymd: string, months: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayYmdToronto(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function serviceSlugLabel(slug: string | null | undefined): string {
  return (slug ?? "").replace(/[-_]+/g, " ").trim();
}

/** Map Postgres errors raised by the growth RPCs/triggers to friendly copy. */
export function growthErrorMessage(raw: unknown, lang: Lang): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "object" && raw && "message" in raw ? String((raw as { message: unknown }).message) : String(raw ?? "");
  const c = GROWTH_COPY[lang].errors;
  if (msg.includes("client_request_limit_reached")) return c.limit;
  if (msg.includes("growth_required")) return c.growth;
  if (msg.includes("bad_first_date")) return c.firstDate;
  if (msg.includes("booking_not_confirmed")) return c.notConfirmed;
  if (msg.includes("booking_series_one_open_per_template") || msg.includes("duplicate key")) return c.duplicate;
  if (msg.includes("forbidden")) return c.forbidden;
  return msg || c.generic;
}

export const GROWTH_COPY = {
  en: {
    locked: "Available on the Growth and Pro plans.",
    upgrade: "See plans",
    errors: {
      limit: "This request is over your plan's monthly client request limit. Upgrade your plan to accept it.",
      growth: "This feature is available on the Growth and Pro plans.",
      firstDate: "Pick a first date between tomorrow and 120 days from now.",
      notConfirmed: "Only confirmed or completed bookings can repeat.",
      duplicate: "A repeat booking already exists for this booking.",
      forbidden: "You can't change this item.",
      generic: "Something went wrong. Please try again.",
    },
    crm: {
      title: "Client history",
      intro: "Every client who booked you: past jobs, totals, last visit and your private notes. Clients never see your notes.",
      empty: "No clients yet. Clients appear here after their first booking.",
      search: "Search clients",
      bookings: "Bookings",
      completed: "Completed",
      paid: "Paid through AltShift",
      lastVisit: "Last visit",
      nextVisit: "Next visit",
      suggested: "Suggested next visit",
      repeatClient: "Repeat client",
      notes: "Private notes",
      notesPlaceholder: "Preferences, access codes, equipment, anything useful for next time…",
      saveNote: "Save note",
      noteSaved: "Note saved",
      history: "Service history",
      setupRepeat: "Set up repeat booking",
      unnamed: "Client",
      status: { pending: "Pending", accepted: "Confirmed", completed: "Completed", cancelled: "Cancelled", declined: "Declined" } as Record<string, string>,
    },
    reminders: {
      title: "Returning-customer reminders",
      intro: "AltShift sends each past client one friendly “book again” reminder when they are due, with a one-tap Book Again link.",
      enable: "Send rebooking reminders",
      after: "Remind clients after",
      weeks: "weeks",
      howEmail: "Sent by email. On the Pro plan, clients with a mobile number get a text instead.",
      rules: "One reminder per client per visit. Never sent if the client already has an upcoming or repeat booking with you, or opted out. Sent 10 a.m.–8 p.m. (Quebec time).",
      renewNote: "If a client chose your service's renewal interval when booking, the reminder follows that date instead.",
      save: "Save",
      saved: "Reminder settings saved",
      sentCount: "Reminders sent so far: {{n}}",
    },
    series: {
      title: "Repeat bookings",
      introPro: "Recurring bookings with your clients. Each visit arrives as a normal booking request a week ahead.",
      introClient: "Your recurring bookings. Each visit is created a week ahead and confirmed by the professional.",
      empty: "No repeat bookings yet.",
      autoApprove: "Auto-approve repeat visits",
      autoApproveHint: "When on, visits from repeat bookings are confirmed automatically (within your plan's monthly request limit). Clients still pay through AltShift like any booking.",
      freq: { weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" } as Record<string, string>,
      statusLabel: { proposed: "Waiting for client", active: "Active", paused: "Paused", cancelled: "Cancelled" } as Record<string, string>,
      proposedToYou: "Proposed by your professional",
      next: "Next visit",
      pause: "Pause",
      resume: "Resume",
      cancel: "Cancel",
      accept: "Accept",
      decline: "Decline",
      confirmCancel: "Cancel this repeat booking? Bookings already created stay as they are.",
      updated: "Repeat booking updated",
      setupTitle: "Repeat this booking",
      setupIntro: "Same professional, service, time and place. Each visit is created a week ahead as a booking request; the professional confirms it and you pay for each visit like a normal booking. Pause or cancel anytime.",
      setupIntroPro: "Proposes a recurring booking to your client (same service, time and place). It starts once the client accepts. Pause or cancel anytime.",
      frequency: "How often",
      firstDate: "First visit",
      create: "Start repeat booking",
      propose: "Propose to client",
      created: "Repeat booking set up",
      proposed: "Proposal sent to your client",
      makeRepeat: "Repeat",
      badge: "Repeat",
    },
    bookAgain: {
      button: "Book again",
      loading: "Opening your booking…",
      notFound: "We couldn't find that booking on your account.",
      signIn: "Sign in to book again.",
      optOutLabel: "Rebooking reminders from professionals",
      optOutHint: "Occasional “book again” reminders from pros you booked before.",
      optOutSaved: "Preference saved",
    },
    unsubscribe: {
      title: "Rebooking reminders",
      working: "Updating your preference…",
      done: "You won't get rebooking reminders anymore. You can turn them back on from your dashboard.",
      failed: "This link is invalid or expired. You can turn reminders off from your dashboard.",
      dashboard: "Go to dashboard",
    },
  },
  fr: {
    locked: "Offert avec les forfaits Croissance et Performance.",
    upgrade: "Voir les forfaits",
    errors: {
      limit: "Cette demande dépasse la limite mensuelle de demandes client de votre forfait. Passez à un forfait supérieur pour l’accepter.",
      growth: "Cette fonction est offerte avec les forfaits Croissance et Performance.",
      firstDate: "Choisissez une première date entre demain et dans 120 jours.",
      notConfirmed: "Seules les réservations confirmées ou terminées peuvent être répétées.",
      duplicate: "Une réservation répétée existe déjà pour cette réservation.",
      forbidden: "Vous ne pouvez pas modifier cet élément.",
      generic: "Une erreur est survenue. Veuillez réessayer.",
    },
    crm: {
      title: "Historique clients",
      intro: "Tous les clients qui vous ont réservé : travaux passés, totaux, dernière visite et vos notes privées. Les clients ne voient jamais vos notes.",
      empty: "Aucun client pour l’instant. Les clients apparaissent ici après leur première réservation.",
      search: "Rechercher un client",
      bookings: "Réservations",
      completed: "Terminées",
      paid: "Payé via AltShift",
      lastVisit: "Dernière visite",
      nextVisit: "Prochaine visite",
      suggested: "Prochaine visite suggérée",
      repeatClient: "Client fidèle",
      notes: "Notes privées",
      notesPlaceholder: "Préférences, codes d’accès, équipement, tout ce qui sera utile la prochaine fois…",
      saveNote: "Enregistrer la note",
      noteSaved: "Note enregistrée",
      history: "Historique des services",
      setupRepeat: "Créer une réservation répétée",
      unnamed: "Client",
      status: { pending: "En attente", accepted: "Confirmée", completed: "Terminée", cancelled: "Annulée", declined: "Refusée" } as Record<string, string>,
    },
    reminders: {
      title: "Rappels aux clients récurrents",
      intro: "AltShift envoie à chaque ancien client un rappel « Réserver à nouveau » au bon moment, avec un lien pour réserver en un clic.",
      enable: "Envoyer des rappels de nouvelle réservation",
      after: "Rappeler les clients après",
      weeks: "semaines",
      howEmail: "Envoyé par courriel. Avec le forfait Performance, les clients ayant un numéro de cellulaire reçoivent plutôt un texto.",
      rules: "Un seul rappel par client et par visite. Jamais envoyé si le client a déjà une réservation à venir ou répétée avec vous, ou s’il s’est désabonné. Envoyé de 10 h à 20 h (heure du Québec).",
      renewNote: "Si un client a choisi l’intervalle de renouvellement de votre service lors de la réservation, le rappel suit plutôt cette date.",
      save: "Enregistrer",
      saved: "Paramètres des rappels enregistrés",
      sentCount: "Rappels envoyés jusqu’ici : {{n}}",
    },
    series: {
      title: "Réservations répétées",
      introPro: "Les réservations récurrentes avec vos clients. Chaque visite arrive comme une demande de réservation normale une semaine à l’avance.",
      introClient: "Vos réservations récurrentes. Chaque visite est créée une semaine à l’avance et confirmée par le professionnel.",
      empty: "Aucune réservation répétée pour l’instant.",
      autoApprove: "Approuver automatiquement les visites répétées",
      autoApproveHint: "Si activé, les visites des réservations répétées sont confirmées automatiquement (dans la limite mensuelle de demandes de votre forfait). Les clients paient quand même via AltShift comme pour toute réservation.",
      freq: { weekly: "Chaque semaine", biweekly: "Toutes les 2 semaines", monthly: "Chaque mois" } as Record<string, string>,
      statusLabel: { proposed: "En attente du client", active: "Active", paused: "En pause", cancelled: "Annulée" } as Record<string, string>,
      proposedToYou: "Proposée par votre professionnel",
      next: "Prochaine visite",
      pause: "Mettre en pause",
      resume: "Reprendre",
      cancel: "Annuler",
      accept: "Accepter",
      decline: "Refuser",
      confirmCancel: "Annuler cette réservation répétée? Les réservations déjà créées restent telles quelles.",
      updated: "Réservation répétée mise à jour",
      setupTitle: "Répéter cette réservation",
      setupIntro: "Même professionnel, service, heure et lieu. Chaque visite est créée une semaine à l’avance comme demande de réservation; le professionnel la confirme et vous payez chaque visite comme une réservation normale. Mettez en pause ou annulez en tout temps.",
      setupIntroPro: "Propose une réservation récurrente à votre client (même service, heure et lieu). Elle commence dès que le client accepte. Mettez en pause ou annulez en tout temps.",
      frequency: "Fréquence",
      firstDate: "Première visite",
      create: "Démarrer la réservation répétée",
      propose: "Proposer au client",
      created: "Réservation répétée créée",
      proposed: "Proposition envoyée à votre client",
      makeRepeat: "Répéter",
      badge: "Répétée",
    },
    bookAgain: {
      button: "Réserver à nouveau",
      loading: "Ouverture de votre réservation…",
      notFound: "Nous n’avons pas trouvé cette réservation dans votre compte.",
      signIn: "Connectez-vous pour réserver à nouveau.",
      optOutLabel: "Rappels de nouvelle réservation des professionnels",
      optOutHint: "Rappels occasionnels « Réserver à nouveau » des pros que vous avez déjà réservés.",
      optOutSaved: "Préférence enregistrée",
    },
    unsubscribe: {
      title: "Rappels de nouvelle réservation",
      working: "Mise à jour de votre préférence…",
      done: "Vous ne recevrez plus de rappels de nouvelle réservation. Vous pouvez les réactiver depuis votre tableau de bord.",
      failed: "Ce lien est invalide ou expiré. Vous pouvez désactiver les rappels depuis votre tableau de bord.",
      dashboard: "Aller au tableau de bord",
    },
  },
} as const;

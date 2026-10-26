/** Booking cancellation policy, per service (preferred) or profile fallback. */

export type BookingCancelPolicy = "free" | "late_fee" | "no_cancel";
export type BookingCancelFeeType = "percent" | "fixed";
export type BookingCancelFeePercent = 25 | 50 | 75;

export type ResolvedCancelPolicy = {
  policy: BookingCancelPolicy;
  feeType: BookingCancelFeeType;
  feePercent: BookingCancelFeePercent;
  /** Fixed fee in cents (when feeType === "fixed"). */
  feeCents: number;
};

export function normalizeBookingCancelPolicy(raw: string | null | undefined): BookingCancelPolicy {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "free" || s === "no_cancel" || s === "late_fee") return s;
  return "late_fee";
}

export function normalizeBookingCancelFeeType(raw: string | null | undefined): BookingCancelFeeType {
  return (raw ?? "").toLowerCase().trim() === "fixed" ? "fixed" : "percent";
}

export function normalizeBookingCancelFeePercent(raw: number | null | undefined): BookingCancelFeePercent {
  if (raw === 25 || raw === 50 || raw === 75) return raw;
  return 50;
}

export function normalizeBookingCancelFeeCents(raw: number | null | undefined): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 0;
  return Math.max(0, Math.min(10_000_000, n));
}

export function resolveServiceCancelPolicy(input: {
  cancel_policy?: string | null;
  cancel_fee_type?: string | null;
  cancel_fee_percent?: number | null;
  cancel_fee_cents?: number | null;
} | null | undefined): ResolvedCancelPolicy {
  return {
    policy: normalizeBookingCancelPolicy(input?.cancel_policy),
    feeType: normalizeBookingCancelFeeType(input?.cancel_fee_type),
    feePercent: normalizeBookingCancelFeePercent(input?.cancel_fee_percent),
    feeCents: normalizeBookingCancelFeeCents(input?.cancel_fee_cents),
  };
}

/** Client-facing plain language (EN/FR). */
export function formatResolvedCancelPolicyText(
  resolved: ResolvedCancelPolicy,
  locale: "en" | "fr",
  _servicePriceCents?: number | null,
): { title: string; body: string; short: string } {
  const { policy } = resolved;

  if (locale === "fr") {
    if (policy === "free") {
      return {
        title: "Annulation : gratuite",
        short: "Annulation gratuite",
        body: "Vous pouvez annuler cette réservation sans frais d’annulation selon la politique de ce service. Conservez une preuve de votre annulation.",
      };
    }
    if (policy === "no_cancel") {
      return {
        title: "Annulation après confirmation",
        short: "Annulation permise, dommages réels seulement",
        body: "Vous pouvez annuler après la confirmation. Le Pro peut réclamer uniquement les dommages réels qu’il a subis, raisonnablement prouvés et causés par l’annulation. Aucun pourcentage prédéterminé ni prix intégral automatique ne s’applique du seul fait de l’annulation. Tout montant perçu au-delà des dommages prouvés doit être remboursé.",
      };
    }
    return {
      title: "Annulation gratuite jusqu’à 24 h avant",
      short: "Gratuite jusqu’à 24 h avant",
      body: "Vous pouvez annuler sans frais jusqu’à 24 heures avant le début du service. Après cette échéance, vous pouvez toujours annuler, mais le Pro peut réclamer uniquement les dommages réels qu’il a subis, raisonnablement prouvés et causés par l’annulation tardive. Aucun pourcentage prédéterminé ni prix intégral automatique ne s’applique du seul fait de l’annulation. Tout montant perçu au-delà des dommages prouvés doit être remboursé.",
    };
  }

  if (policy === "free") {
    return {
      title: "Cancellation: free",
      short: "Free cancellation",
      body: "You may cancel this booking without a cancellation fee under this service’s policy. Keep proof of your cancellation.",
    };
  }
  if (policy === "no_cancel") {
    return {
      title: "Cancellation after confirmation",
      short: "Cancellation allowed, actual damages only",
      body: "You may cancel after confirmation. The Pro may claim only actual, reasonably proven damages caused by the cancellation. No preset percentage or automatic full service price applies solely because you cancel. Any amount collected above proven damages must be refunded.",
    };
  }
  return {
    title: "Free cancellation until 24 hours before",
    short: "Free until 24 hours before",
    body: "You may cancel without charge until 24 hours before the service starts. After that cutoff, you may still cancel, but the Pro may claim only actual, reasonably proven damages caused by the late cancellation. No preset percentage or automatic full service price applies solely because you cancel. Any amount collected above proven damages must be refunded.",
  };
}

/** @deprecated Prefer formatResolvedCancelPolicyText */
export function formatBookingCancelPolicyText(
  policy: BookingCancelPolicy,
  feePercent: BookingCancelFeePercent,
  locale: "en" | "fr",
): { title: string; body: string; short: string } {
  return formatResolvedCancelPolicyText(
    { policy, feeType: "percent", feePercent, feeCents: 0 },
    locale,
  );
}

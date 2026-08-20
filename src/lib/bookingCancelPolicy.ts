/** Booking cancellation policy — per service (preferred) or profile fallback. */

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

function moneyCad(cents: number, locale: "en" | "fr"): string {
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return locale === "fr" ? `${dollars} $ CA` : `CA$${dollars}`;
}

/** Client-facing plain language (EN/FR). */
export function formatResolvedCancelPolicyText(
  resolved: ResolvedCancelPolicy,
  locale: "en" | "fr",
  servicePriceCents?: number | null,
): { title: string; body: string; short: string } {
  const { policy, feeType, feePercent, feeCents } = resolved;

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
        title: "Annulation : non remboursable",
        short: "Aucune annulation — frais complets",
        body: "Une fois la réservation confirmée, elle ne peut pas être annulée sans être facturée au complet (100 % du prix du service). En continuant, vous acceptez cette condition.",
      };
    }
    if (feeType === "fixed") {
      const fee = moneyCad(feeCents, "fr");
      const refundHint =
        servicePriceCents != null && servicePriceCents > feeCents
          ? ` Exemple : si le service est ${moneyCad(servicePriceCents, "fr")} et que vous avez déjà payé, un remboursement d’environ ${moneyCad(servicePriceCents - feeCents, "fr")} peut s’appliquer après déduction des frais (sous réserve du traitement du paiement).`
          : "";
      return {
        title: `Annulation : frais fixes de ${fee} si moins de 24 h`,
        short: `${fee} de frais si annulation < 24 h`,
        body: `Si vous annulez moins de 24 heures avant le début du service, des frais d’annulation de ${fee} s’appliquent.${refundHint} Une annulation plus de 24 heures à l’avance peut éviter ces frais de retard. En continuant, vous acceptez cette politique.`,
      };
    }
    return {
      title: `Annulation : frais de ${feePercent} % si moins de 24 h`,
      short: `${feePercent} % de frais si annulation < 24 h`,
      body: `Si vous annulez moins de 24 heures avant le début du service, des frais d’annulation de ${feePercent} % du prix du service s’appliquent. Une annulation plus de 24 heures à l’avance peut être sans ces frais de retard. En continuant, vous acceptez cette politique.`,
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
      title: "Cancellation: non-refundable",
      short: "No cancellation — full charge",
      body: "Once this booking is confirmed, it cannot be cancelled without being charged in full (100% of the service price). By continuing, you accept this condition.",
    };
  }
  if (feeType === "fixed") {
    const fee = moneyCad(feeCents, "en");
    const refundHint =
      servicePriceCents != null && servicePriceCents > feeCents
        ? ` Example: if the service is ${moneyCad(servicePriceCents, "en")} and you already paid, about ${moneyCad(servicePriceCents - feeCents, "en")} may be refunded after the fee is deducted (subject to payment processing).`
        : "";
    return {
      title: `Cancellation: ${fee} fee if under 24 hours`,
      short: `${fee} fee if cancel < 24h`,
      body: `If you cancel less than 24 hours before the service start time, a ${fee} cancellation fee applies.${refundHint} Cancelling more than 24 hours ahead may avoid this late fee. By continuing, you accept this policy.`,
    };
  }
  return {
    title: `Cancellation: ${feePercent}% fee if under 24 hours`,
    short: `${feePercent}% fee if cancel < 24h`,
    body: `If you cancel less than 24 hours before the service start time, a ${feePercent}% cancellation fee of the service price applies. Cancelling more than 24 hours ahead may avoid this late fee. By continuing, you accept this policy.`,
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

import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";

/** Minimum service budget (before tax & platform fee), CAD. */
export const JOB_REQUEST_BUDGET_MIN_BASE = 20;

/** All-in total (GST + QST + 5% platform fee) from a service subtotal in dollars. */
export function budgetAllInFromBase(baseDollars: number): number {
  if (!Number.isFinite(baseDollars) || baseDollars <= 0) return 0;
  const cents = Math.round(baseDollars * 100);
  return Math.round(computeBookingInvoiceFromBaseCents(cents).totalCents) / 100;
}

/** Round to whole dollars for job-request budget fields. */
export function budgetAllInRounded(baseDollars: number): number {
  return Math.round(budgetAllInFromBase(baseDollars));
}

export function parseBudgetDigits(raw: string): number | null {
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/**
 * Clamp service budget bases.
 * - Always: when both set, max ≥ min
 * - enforceFloor: min/max at least JOB_REQUEST_BUDGET_MIN_BASE (use on blur/submit, not mid-typing)
 */
export function clampBudgetBases(
  minRaw: string,
  maxRaw: string,
  opts?: { enforceFloor?: boolean },
): { min: string; max: string } {
  let minN = parseBudgetDigits(minRaw);
  let maxN = parseBudgetDigits(maxRaw);
  const floor = opts?.enforceFloor === true;

  if (floor) {
    if (minN != null && minN > 0 && minN < JOB_REQUEST_BUDGET_MIN_BASE) {
      minN = JOB_REQUEST_BUDGET_MIN_BASE;
    }
    if (maxN != null && maxN > 0 && maxN < JOB_REQUEST_BUDGET_MIN_BASE) {
      maxN = JOB_REQUEST_BUDGET_MIN_BASE;
    }
  }
  if (minN != null && maxN != null && maxN < minN) {
    maxN = minN;
  }

  return {
    min: minN != null ? String(minN) : minRaw.replace(/\D/g, ""),
    max: maxN != null ? String(maxN) : maxRaw.replace(/\D/g, ""),
  };
}

export function budgetAllInPair(minRaw: string, maxRaw: string): {
  minBase: number | null;
  maxBase: number | null;
  minAllIn: number | null;
  maxAllIn: number | null;
} {
  const { min, max } = clampBudgetBases(minRaw, maxRaw);
  const minBase = parseBudgetDigits(min);
  const maxBase = parseBudgetDigits(max);
  return {
    minBase,
    maxBase,
    minAllIn: minBase != null && minBase > 0 ? budgetAllInRounded(minBase) : null,
    maxAllIn: maxBase != null && maxBase > 0 ? budgetAllInRounded(maxBase) : null,
  };
}

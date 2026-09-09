/**
 * Demo and Advertising Showcase Accounts.
 *
 * Provides dedicated detection and simulation helpers for promotional video recording,
 * client walkthroughs, and advertising purposes without connecting real Square accounts
 * or processing actual credit card charges.
 */

export const DEMO_CLIENT_EMAIL = "demo.client@premierservices.demo";
export const DEMO_PRO_EMAIL = "demo.pro@premierservices.demo";

export const DEMO_PRO_BUSINESS_NAME = "Rivera Home Services";
export const DEMO_PRO_PHONE = "514-555-0142";
export const DEMO_CLIENT_PHONE = "514-555-0198";

/**
 * Checks if an email belongs to a designated demo / advertising account.
 */
export function isDemoAccount(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const em = email.toLowerCase().trim();
  return (
    em === DEMO_CLIENT_EMAIL ||
    em === DEMO_PRO_EMAIL ||
    em.endsWith("@premierservices.demo") ||
    em.startsWith("demo.client@") ||
    em.startsWith("demo.pro@") ||
    em.startsWith("demo-client@") ||
    em.startsWith("demo-pro@") ||
    em.includes("+demo@")
  );
}

/**
 * Checks if a pro profile is the designated showcase / demo pro.
 */
export function isDemoProProfile(
  pro?: {
    business_name?: string | null;
    phone?: string | null;
    is_demo?: boolean | null;
  } | null
): boolean {
  if (!pro) return false;
  if (pro.is_demo === true) return true;
  if (pro.business_name && pro.business_name.trim() === DEMO_PRO_BUSINESS_NAME) return true;
  if (pro.phone && pro.phone.trim() === DEMO_PRO_PHONE) return true;
  return false;
}

/**
 * Generates mock Square payment authorization data for demo bookings and quotes.
 * Zero real credit card or processor calls are made.
 */
export function createDemoPaymentMeta(amountCents: number) {
  const nonce = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    squarePaymentId: `sq_demo_mock_${nonce}`,
    idempotencyKey: `demo_idemp_${nonce}_${rand}`,
    paymentMethodLabel: "Visa •••• 4242 (Demo / Ad Mode)",
    amountCents,
  };
}

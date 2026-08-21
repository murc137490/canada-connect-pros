import { supabase } from "@/integrations/supabase/client";

export type ApplePayHandoffDraft = {
  proProfileId: string;
  clientId: string;
  phone: string;
  squareLocationId?: string | null;
  amountCents: number;
  baseAmountCents: number;
  serviceName: string;
  durationLabel?: string | null;
  dateLabel: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceCategorySlug?: string | null;
  serviceSlug?: string | null;
  serviceDurationMinutes?: number | null;
  serviceLocationChoice?: string | null;
};

export type ApplePayHandoffRow = {
  id: string;
  client_id: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  draft: ApplePayHandoffDraft;
  square_payment_id: string | null;
  idempotency_key: string | null;
  payment_method_label: string | null;
  booking_id: string | null;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
};

// Table added via migration; generated Database types may lag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handoffs = () => (supabase as any).from("apple_pay_handoffs");

export function applePayHandoffUrl(handoffId: string): string {
  // iPhone must open a public HTTPS host with Apple Pay domain verified.
  // Never encode localhost / preview hosts into the QR — the phone cannot pay there.
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "";
  const browserHost =
    typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "").toLowerCase() : "";
  const onProductionHost = browserHost === "premiereservices.ca";
  const origin = onProductionHost
    ? window.location.origin
    : configured || "https://www.premiereservices.ca";
  return `${origin}/pay/apple-handoff/${encodeURIComponent(handoffId)}`;
}

export async function createApplePayHandoff(draft: ApplePayHandoffDraft): Promise<ApplePayHandoffRow> {
  const { data, error } = await handoffs()
    .insert({
      client_id: draft.clientId,
      draft,
      status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ApplePayHandoffRow;
}

export async function fetchApplePayHandoff(id: string): Promise<ApplePayHandoffRow | null> {
  const { data, error } = await handoffs().select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApplePayHandoffRow | null) ?? null;
}

export async function markApplePayHandoffPaid(
  id: string,
  meta: {
    squarePaymentId?: string | null;
    idempotencyKey: string;
    paymentMethodLabel?: string | null;
    bookingId?: string | null;
  },
): Promise<void> {
  const { error } = await handoffs()
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      square_payment_id: meta.squarePaymentId ?? null,
      idempotency_key: meta.idempotencyKey,
      payment_method_label: meta.paymentMethodLabel ?? null,
      booking_id: meta.bookingId ?? null,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BookingCheckout from "@/components/BookingCheckout";
import type { BookingPaymentMeta } from "@/components/BookingCheckout";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBookingInvoiceSnapshot } from "@/lib/bookingInvoiceSnapshot";

type BookingRow = {
  id: string;
  pro_profile_id: string;
  service_category_slug?: string | null;
  service_slug?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  service_duration_minutes?: number | null;
  invoice_snapshot?: unknown;
  public_booking_code?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRow | null;
  businessName?: string | null;
  squareLocationId?: string | null;
  clientId: string;
  onPaid: () => void;
};

export default function ClientBookingPayDialog({
  open,
  onOpenChange,
  booking,
  businessName,
  squareLocationId,
  clientId,
  onPaid,
}: Props) {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  const norm = normalizeBookingInvoiceSnapshot(booking.id, booking.invoice_snapshot, {
    fallbackBookingPublicCode: booking.public_booking_code ?? undefined,
  });
  const baseCents = norm?.subtotal_cents ?? 5000;

  const dateLabel = booking.preferred_date
    ? new Date(String(booking.preferred_date) + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" })
    : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>{t.terms.bookingPayNowTitle ?? "Complete payment"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {(t.terms.bookingPayNowSubtitle ?? "{{name}} accepted your request.").replace(
              "{{name}}",
              businessName?.trim() || t.common.proFallback || "Professional",
            )}
          </p>
        </DialogHeader>
        {error ? <p className="px-5 text-sm text-destructive">{error}</p> : null}
        <BookingCheckout
          serviceName={businessName?.trim() || t.common.proFallback || "Service"}
          dateLabel={dateLabel}
          baseAmountCents={Math.max(500, baseCents)}
          squareLocationId={squareLocationId}
          currency="cad"
          proProfileId={booking.pro_profile_id}
          clientId={clientId}
          onPaymentComplete={async (paymentMeta: BookingPaymentMeta) => {
            if (paymentMeta.idempotencyKey) {
              const { error: linkErr } = await supabase
                .from("payments")
                .update({ booking_id: booking.id })
                .eq("idempotency_key", paymentMeta.idempotencyKey);
              if (linkErr) console.warn("payment link:", linkErr.message);
            }
            onPaid();
            return { bookingId: booking.id, bookingPublicCode: booking.public_booking_code ?? undefined };
          }}
          onError={(msg) => setError(msg)}
          onDone={() => {
            setError(null);
            onOpenChange(false);
            onPaid();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

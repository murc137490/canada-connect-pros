import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeBookingInvoiceSnapshot } from "@/lib/bookingInvoiceSnapshot";
import { buildQuebecBilingualInvoiceHtml } from "@/lib/quebecInvoiceHtml";
import { useLanguage } from "@/contexts/LanguageContext";
import { PREMIERE_FAVICON_DATA_URI } from "@/lib/siteFavicon";

export type BookingPaymentRow = {
  amount_cents: number;
  currency: string;
  square_payment_id: string | null;
  status: string;
};

export default function BookingInvoiceCard({
  bookingId,
  bookingPublicCode,
  bookingStatus,
  businessName,
  createdAt,
  snapshotJson,
  payment,
  showSupplierAddress = false,
  onReport,
}: {
  bookingId: string;
  bookingPublicCode?: string | null;
  bookingStatus: string;
  businessName: string;
  createdAt: string;
  snapshotJson: unknown;
  payment: BookingPaymentRow | null;
  /** When true, supplier address may appear under “View details” (service at pro’s location). */
  showSupplierAddress?: boolean;
  onReport: () => void;
}) {
  const { t, locale } = useLanguage();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const norm = normalizeBookingInvoiceSnapshot(bookingId, snapshotJson, {
    fallbackBookingPublicCode: bookingPublicCode ?? undefined,
  });
  const refDisplay = norm?.booking_reference_code?.trim() || bookingPublicCode?.trim().toUpperCase() || "-";

  const totalDisplay = norm
    ? `${(norm.total_cents / 100).toFixed(2)} ${norm.currency}`
    : payment
      ? `${(payment.amount_cents / 100).toFixed(2)} ${payment.currency}`
      : "-";

  const dateDisplay =
    norm?.appointment_summary?.trim() ||
    (norm?.preferred_date
      ? new Date(`${norm.preferred_date}T12:00:00`).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
          dateStyle: "medium",
        })
      : new Date(createdAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" }));

  const paymentMethodDisplay =
    norm?.payment_method_label?.trim() ||
    (payment?.status ? payment.status : locale === "fr" ? "-" : "-");

  const invNoShort =
    norm?.invoice_number != null
      ? `PS-${new Date(norm.invoice_date_iso).getFullYear()}-${String(norm.invoice_number).padStart(7, "0")}`
      : null;

  const printInvoice = useCallback(() => {
    if (norm) {
      const html = buildQuebecBilingualInvoiceHtml(norm, { showSupplierAddress });
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      w.close();
      return;
    }
    const title = t.dashboard.invoicePrintTitle ?? "Booking invoice";
    const lines: string[] = [];
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const push = (label: string, value: string) => {
      lines.push(
        `<tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid #e5e5e5;color:#555;">${esc(label)}</td><td style="padding:6px 0;border-bottom:1px solid #e5e5e5;font-weight:500;">${esc(value)}</td></tr>`,
      );
    };
    if (payment) {
      push(t.dashboard.invoiceDate ?? "Date", dateDisplay);
      push(t.dashboard.invoiceTotal ?? "Total charged", `${(payment.amount_cents / 100).toFixed(2)} ${payment.currency}`);
      push(t.dashboard.invoicePaymentMethod ?? "Payment method", paymentMethodDisplay);
    } else {
      lines.push(
        `<tr><td colspan="2" style="padding:12px;color:#666;">${esc(
          t.dashboard.invoiceLimitedLegacy ?? "Limited receipt - detailed invoice was not stored for this booking.",
        )}</td></tr>`,
      );
    }
    push(t.dashboard.invoiceBookingRef ?? "Booking reference", refDisplay);
    push(t.dashboard.invoiceStatus ?? "Booking status", bookingStatus);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><link rel="icon" href="${PREMIERE_FAVICON_DATA_URI}"/><title>${esc(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;max-width:640px;margin:0 auto;"><h1>${esc(title)}</h1><table style="width:100%;border-collapse:collapse;font-size:14px;">${lines.join("")}</table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [
    bookingId,
    bookingStatus,
    dateDisplay,
    locale,
    norm,
    payment,
    paymentMethodDisplay,
    refDisplay,
    showSupplierAddress,
    t.dashboard,
  ]);

  const hasExpandableDetails = Boolean(norm || payment);

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4 text-sm">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">{businessName}</p>
        <p className="text-xs text-muted-foreground font-mono truncate" title={bookingId}>
          {refDisplay}
        </p>
        <p className="text-xs text-muted-foreground">
          {(t.dashboard.invoiceStatus ?? "Status") + ": "}
          <span className="font-medium text-foreground">{bookingStatus}</span>
        </p>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
        <SummaryRow label={t.dashboard.invoiceDate ?? "Date"} value={dateDisplay} emphasis />
        <SummaryRow label={t.dashboard.invoiceTotal ?? "Total charged"} value={totalDisplay} emphasis />
        <SummaryRow label={t.dashboard.invoicePaymentMethod ?? "Payment method"} value={paymentMethodDisplay} emphasis />
      </div>

      {hasExpandableDetails ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setDetailsOpen((o) => !o)}
          >
            <span>
              {detailsOpen
                ? (t.dashboard.invoiceHideDetails ?? "Hide receipt details")
                : (t.dashboard.invoiceViewDetails ?? "View receipt details")}
            </span>
            {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>

          {detailsOpen ? (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs sm:text-sm">
              {norm ? (
                <>
                  {invNoShort ? (
                    <InvoiceRow label={t.dashboard.invoiceNumberLabel ?? "Invoice no."} value={invNoShort} mono />
                  ) : null}
                  <InvoiceRow label={t.dashboard.invoiceSupplierLegal ?? "Supplier (legal)"} value={norm.supplier_legal_name} />
                  {showSupplierAddress && norm.supplier_address?.trim() ? (
                    <InvoiceRow
                      label={t.dashboard.invoiceSupplierAddress ?? "Supplier address"}
                      value={norm.supplier_address}
                    />
                  ) : null}
                  <InvoiceRow
                    label={t.dashboard.invoiceServiceDescription ?? "Service description"}
                    value={norm.service_description}
                  />
                  {norm.appointment_summary && norm.appointment_summary !== dateDisplay ? (
                    <InvoiceRow label={t.dashboard.invoiceAppointment ?? "Appointment"} value={norm.appointment_summary} />
                  ) : null}
                  {norm.client_member_number ? (
                    <InvoiceRow label={t.dashboard.invoiceClientMemberId ?? "Client member ID"} value={norm.client_member_number} mono />
                  ) : null}
                  {norm.pro_member_number ? (
                    <InvoiceRow label={t.dashboard.invoiceProMemberId ?? "Pro member ID"} value={norm.pro_member_number} mono />
                  ) : null}
                  <InvoiceRow label={t.dashboard.invoiceSubtotal ?? "Subtotal (before tax)"} value={`$${norm.subtotal.toFixed(2)}`} />
                  <InvoiceRow label={t.dashboard.invoiceGst ?? "GST (5%)"} value={`$${norm.gst.toFixed(2)}`} />
                  <InvoiceRow label={t.dashboard.invoiceQst ?? "QST (9.975%)"} value={`$${norm.qst.toFixed(2)}`} />
                  <InvoiceRow
                    label={t.dashboard.invoiceProcessing ?? "Processing fee"}
                    value={`$${norm.processing_fee.toFixed(2)}`}
                  />
                  {norm.supplier_gst_display && norm.supplier_gst_display !== "________________________" ? (
                    <InvoiceRow label={t.dashboard.invoiceGstNumber ?? "GST no."} value={norm.supplier_gst_display} />
                  ) : null}
                  {norm.supplier_qst_display && norm.supplier_qst_display !== "________________________" ? (
                    <InvoiceRow label={t.dashboard.invoiceQstNumber ?? "QST no."} value={norm.supplier_qst_display} />
                  ) : null}
                </>
              ) : payment ? (
                <p className="text-xs text-muted-foreground">
                  {t.dashboard.invoicePartialNote ??
                    "Amount shown from payment record; tax breakdown was not stored for this booking."}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t.dashboard.invoiceLimitedLegacy ?? "Limited receipt - detailed invoice was not stored for this booking."}
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t.dashboard.invoiceLimitedLegacy ?? "Limited receipt - detailed invoice was not stored for this booking."}
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={printInvoice}>
          <Printer size={14} /> {t.dashboard.invoicePrint ?? "Print / PDF"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReport}>
          {t.dashboard.invoiceReportIssue ?? "Report an issue"}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${emphasis ? "text-base font-semibold text-foreground" : "font-medium text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function InvoiceRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-foreground text-right ${mono ? "font-mono text-[11px] sm:text-xs break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}

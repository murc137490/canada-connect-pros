import type { NormalizedBookingInvoice } from "@/lib/bookingInvoiceSnapshot";
import { PREMIERE_FAVICON_DATA_URI } from "@/lib/siteFavicon";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number, cur: string) {
  return `${n.toFixed(2)} ${cur}`;
}

function formatInvoiceNumber(inv: NormalizedBookingInvoice): string {
  if (inv.invoice_number == null) return "—";
  const y = new Date(inv.invoice_date_iso).getFullYear();
  return `PS-${y}-${String(inv.invoice_number).padStart(7, "0")}`;
}

function formatDateFr(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { dateStyle: "long" });
}

function formatDateEn(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "long" });
}

function formatDateTimeFr(iso: string) {
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
}

function formatDateTimeEn(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" });
}

function formatAppointmentFr(inv: NormalizedBookingInvoice): string {
  const parts: string[] = [];
  if (inv.appointment_summary?.trim()) parts.push(inv.appointment_summary.trim());
  if (inv.preferred_date?.trim()) parts.push(`Date : ${inv.preferred_date.trim()}`);
  if (inv.preferred_time?.trim()) parts.push(`Heure : ${inv.preferred_time.trim()}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatAppointmentEn(inv: NormalizedBookingInvoice): string {
  const parts: string[] = [];
  if (inv.appointment_summary?.trim()) parts.push(inv.appointment_summary.trim());
  if (inv.preferred_date?.trim()) parts.push(`Date: ${inv.preferred_date.trim()}`);
  if (inv.preferred_time?.trim()) parts.push(`Time: ${inv.preferred_time.trim()}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export type QuebecInvoicePrintOptions = {
  /** Include supplier business address (e.g. service at pro’s workspace). */
  showSupplierAddress?: boolean;
};

/** Quebec receipt: complete French section, then complete English section. */
export function buildQuebecBilingualInvoiceHtml(
  inv: NormalizedBookingInvoice,
  opts?: QuebecInvoicePrintOptions,
): string {
  const showSupplierAddress = opts?.showSupplierAddress === true;
  const supplierAddressBlock = showSupplierAddress && inv.supplier_address?.trim()
    ? inv.supplier_address.trim()
    : null;
  const invNo = formatInvoiceNumber(inv);
  const bookingRef = inv.booking_reference_code?.trim() || "—";
  const internalId =
    inv.booking_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv.booking_id)
      ? inv.booking_id
      : null;
  const sub = money(inv.subtotal, inv.currency);
  const gst = money(inv.gst, inv.currency);
  const qst = money(inv.qst, inv.currency);
  const proc = money(inv.processing_fee, inv.currency);
  const tot = money(inv.total_cents / 100, inv.currency);
  const apptFr = formatAppointmentFr(inv);
  const apptEn = formatAppointmentEn(inv);

  const frBlock = `
    <section style="margin-bottom:28px;">
      <h2 style="font-size:1.15rem;margin:0 0 12px;border-bottom:2px solid #333;padding-bottom:6px;">Facture</h2>
      <p style="margin:4px 0;"><strong>Date de la facture :</strong> ${esc(formatDateFr(inv.invoice_date_iso))}</p>
      <p style="margin:4px 0;"><strong>No de facture :</strong> ${esc(invNo)}</p>
      <p style="margin:4px 0;"><strong>Référence de réservation :</strong> ${esc(bookingRef)}</p>
      ${inv.client_member_number ? `<p style="margin:4px 0;"><strong>No membre client :</strong> ${esc(inv.client_member_number)}</p>` : ""}
      ${inv.pro_member_number ? `<p style="margin:4px 0;"><strong>No membre professionnel :</strong> ${esc(inv.pro_member_number)}</p>` : ""}
      ${internalId ? `<p style="margin:2px 0 0;font-size:11px;color:#888;font-family:monospace;">Identifiant système : ${esc(internalId)}</p>` : ""}
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Fournisseur (prestataire)</h3>
      <p style="margin:4px 0;"><strong>Dénomination légale (ou inscription au REQ) :</strong><br/>${esc(inv.supplier_legal_name)}</p>
      ${supplierAddressBlock ? `<p style="margin:4px 0;white-space:pre-wrap;"><strong>Adresse :</strong><br/>${esc(supplierAddressBlock)}</p>` : ""}
      <p style="margin:4px 0;"><strong>Nom affiché du professionnel :</strong> ${esc(inv.professional_name)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Numéros d'enregistrement fiscal (Québec)</h3>
      <p style="margin:4px 0;"><strong>No TPS (9 chiffres + RT0001) :</strong> ${esc(inv.supplier_gst_display)}</p>
      <p style="margin:4px 0;"><strong>No TVQ (10 chiffres + TQ0001) :</strong> ${esc(inv.supplier_qst_display)}</p>
      <p style="margin:4px 0;font-size:12px;color:#555;">Les numéros ci-dessus sont à compléter par le fournisseur lorsqu'ils sont disponibles.</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Description des services</h3>
      <p style="margin:4px 0;white-space:pre-wrap;">${esc(inv.service_description)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Date de la prestation</h3>
      <p style="margin:4px 0;"><strong>Date et heure prévues :</strong> ${esc(apptFr)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Répartition fiscale</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">Sous-total (avant taxes)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(sub)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">TPS (5 %)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(gst)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">TVQ (9,975 %)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(qst)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">Frais carte et plateforme (5 % sur le service, non taxés)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(proc)}</td></tr>
        <tr><td style="padding:8px 0 0;font-weight:bold;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;">${esc(tot)}</td></tr>
      </table>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Paiement</h3>
      <p style="margin:4px 0;"><strong>Mode de paiement :</strong> ${esc(inv.payment_method_label)}</p>
      <p style="margin:4px 0;font-size:12px;"><strong>Paiement reçu le :</strong> ${esc(formatDateTimeFr(inv.paid_at_iso))}</p>
    </section>
  `;

  const enBlock = `
    <section style="margin-bottom:12px;">
      <h2 style="font-size:1.15rem;margin:0 0 12px;border-bottom:2px solid #333;padding-bottom:6px;">Invoice</h2>
      <p style="margin:4px 0;"><strong>Invoice date:</strong> ${esc(formatDateEn(inv.invoice_date_iso))}</p>
      <p style="margin:4px 0;"><strong>Invoice number:</strong> ${esc(invNo)}</p>
      <p style="margin:4px 0;"><strong>Booking reference:</strong> ${esc(bookingRef)}</p>
      ${inv.client_member_number ? `<p style="margin:4px 0;"><strong>Client member ID:</strong> ${esc(inv.client_member_number)}</p>` : ""}
      ${inv.pro_member_number ? `<p style="margin:4px 0;"><strong>Pro member ID:</strong> ${esc(inv.pro_member_number)}</p>` : ""}
      ${internalId ? `<p style="margin:2px 0 0;font-size:11px;color:#888;font-family:monospace;">System ID: ${esc(internalId)}</p>` : ""}
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Supplier (service provider)</h3>
      <p style="margin:4px 0;"><strong>Legal business name (or REQ-registered name):</strong><br/>${esc(inv.supplier_legal_name)}</p>
      ${supplierAddressBlock ? `<p style="margin:4px 0;white-space:pre-wrap;"><strong>Address:</strong><br/>${esc(supplierAddressBlock)}</p>` : ""}
      <p style="margin:4px 0;"><strong>Professional display name:</strong> ${esc(inv.professional_name)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Tax registration (Quebec)</h3>
      <p style="margin:4px 0;"><strong>GST number (9 digits + RT0001):</strong> ${esc(inv.supplier_gst_display)}</p>
      <p style="margin:4px 0;"><strong>QST number (10 digits + TQ0001):</strong> ${esc(inv.supplier_qst_display)}</p>
      <p style="margin:4px 0;font-size:12px;color:#555;">Numbers above are placeholders until provided by the supplier.</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Description of services</h3>
      <p style="margin:4px 0;white-space:pre-wrap;">${esc(inv.service_description)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Date of service</h3>
      <p style="margin:4px 0;"><strong>Scheduled date and time:</strong> ${esc(apptEn)}</p>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Tax breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">Subtotal (before tax)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(sub)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">GST (5%)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(gst)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">QST (9.975%)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(qst)}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">Platform fee (5% on service)</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${esc(proc)}</td></tr>
        <tr><td style="padding:8px 0 0;font-weight:bold;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;">${esc(tot)}</td></tr>
      </table>
      <h3 style="font-size:0.95rem;margin:16px 0 8px;">Payment</h3>
      <p style="margin:4px 0;"><strong>Payment method:</strong> ${esc(inv.payment_method_label)}</p>
      <p style="margin:4px 0;font-size:12px;"><strong>Payment received:</strong> ${esc(formatDateTimeEn(inv.paid_at_iso))}</p>
    </section>
  `;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><link rel="icon" href="${PREMIERE_FAVICON_DATA_URI}"/><title>Premiere Services — ${esc(invNo)}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111;line-height:1.45;">
${frBlock}
<hr style="margin:24px 0;border:none;border-top:1px solid #ccc;"/>
${enBlock}
<p style="margin-top:32px;font-size:11px;color:#888;">Premiere Services — plateforme de mise en relation. Ce document reprend les données fournies au moment du paiement.</p>
<p style="margin-top:8px;font-size:11px;color:#888;">Premiere Services — connection platform. This document reflects the information provided at the time of payment.</p>
</body></html>`;
}

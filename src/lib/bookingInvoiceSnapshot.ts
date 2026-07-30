import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";

/** Legacy snapshots from before Quebec invoice v2. */
export const BOOKING_INVOICE_SNAPSHOT_V1 = 1 as const;
export const BOOKING_INVOICE_SNAPSHOT_V2 = 2 as const;

export type BookingInvoiceSnapshotV1 = {
  v: typeof BOOKING_INVOICE_SNAPSHOT_V1;
  paid_at: string;
  pro_profile_id: string;
  business_name: string;
  service_name: string;
  duration_label?: string | null;
  appointment_summary: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  service_duration_minutes?: number | null;
  service_category_slug?: string | null;
  service_slug?: string | null;
  currency: string;
  base_amount_cents: number;
  subtotal: number;
  gst: number;
  qst: number;
  processing_fee: number;
  total_cents: number;
  square_payment_id?: string | null;
  idempotency_key?: string | null;
  client_renews_annually?: boolean;
  renewal_interval_months?: number | null;
  renewal_anchor_date?: string | null;
  /** 5-character public reference for receipts (matches `bookings.public_booking_code`). */
  booking_public_code?: string | null;
  /** 6-digit Premiere member ID (client). */
  client_member_number?: string | null;
  /** 6-digit Premiere member ID (pro account). */
  pro_member_number?: string | null;
};

/** Stored on `bookings.invoice_snapshot` for new checkouts (Quebec-style bilingual invoice). */
export type BookingInvoiceSnapshotV2 = BookingInvoiceSnapshotV1 & {
  v: typeof BOOKING_INVOICE_SNAPSHOT_V2;
  invoice_number?: number | null;
  supplier_legal_name: string;
  supplier_address: string;
  supplier_gst_number: string | null;
  supplier_qst_number: string | null;
  service_description_detailed: string;
  customer_address: string;
  payment_method_label: string;
};

export type NormalizedBookingInvoice = {
  invoice_number: number | null;
  invoice_date_iso: string;
  paid_at_iso: string;
  supplier_legal_name: string;
  supplier_address: string;
  supplier_gst_display: string;
  supplier_qst_display: string;
  professional_name: string;
  pro_profile_id: string;
  service_description: string;
  appointment_summary: string;
  preferred_date: string | null;
  preferred_time: string | null;
  customer_address: string;
  subtotal: number;
  gst: number;
  qst: number;
  processing_fee: number;
  total_cents: number;
  currency: string;
  payment_method_label: string;
  square_payment_id: string | null;
  /** Internal UUID (support / storage paths). */
  booking_id: string | null;
  /** Short code shown on invoices and confirmation (5 chars). */
  booking_reference_code: string | null;
  client_member_number: string | null;
  pro_member_number: string | null;
  client_renews_annually?: boolean;
  renewal_interval_months?: number | null;
  renewal_anchor_date?: string | null;
};

const PLACEHOLDER_TAX = "________________________";

function blankTaxDisplay(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : PLACEHOLDER_TAX;
}

export function isBookingInvoiceSnapshotV1(x: unknown): x is BookingInvoiceSnapshotV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.v === 1 && typeof o.paid_at === "string" && typeof o.service_name === "string" && typeof o.total_cents === "number";
}

export function isBookingInvoiceSnapshotV2(x: unknown): x is BookingInvoiceSnapshotV2 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 2 &&
    typeof o.paid_at === "string" &&
    typeof o.service_name === "string" &&
    typeof o.total_cents === "number" &&
    typeof o.supplier_legal_name === "string" &&
    typeof o.supplier_address === "string" &&
    typeof o.service_description_detailed === "string" &&
    typeof o.customer_address === "string" &&
    typeof o.payment_method_label === "string"
  );
}

function publicCodeFromSnapshot(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const c = (raw as { booking_public_code?: unknown }).booking_public_code;
  if (typeof c === "string" && c.trim()) return c.trim().toUpperCase();
  return null;
}

export function normalizeBookingInvoiceSnapshot(
  bookingId: string | null,
  raw: unknown,
  opts?: { fallbackBookingPublicCode?: string | null }
): NormalizedBookingInvoice | null {
  const refFromRow =
    typeof opts?.fallbackBookingPublicCode === "string" && opts.fallbackBookingPublicCode.trim()
      ? opts.fallbackBookingPublicCode.trim().toUpperCase()
      : null;
  if (isBookingInvoiceSnapshotV2(raw)) {
    return {
      invoice_number: raw.invoice_number ?? null,
      invoice_date_iso: raw.paid_at,
      paid_at_iso: raw.paid_at,
      supplier_legal_name: raw.supplier_legal_name,
      supplier_address: raw.supplier_address,
      supplier_gst_display: blankTaxDisplay(raw.supplier_gst_number),
      supplier_qst_display: blankTaxDisplay(raw.supplier_qst_number),
      professional_name: raw.business_name,
      pro_profile_id: raw.pro_profile_id,
      service_description: raw.service_description_detailed,
      appointment_summary: raw.appointment_summary,
      preferred_date: raw.preferred_date ?? null,
      preferred_time: raw.preferred_time ?? null,
      customer_address: raw.customer_address,
      subtotal: raw.subtotal,
      gst: raw.gst,
      qst: raw.qst,
      processing_fee: raw.processing_fee,
      total_cents: raw.total_cents,
      currency: raw.currency,
      payment_method_label: raw.payment_method_label,
      square_payment_id: raw.square_payment_id ?? null,
      booking_id: bookingId,
      booking_reference_code: publicCodeFromSnapshot(raw) ?? refFromRow,
      client_member_number: memberNumberFromSnapshot(raw, "client"),
      pro_member_number: memberNumberFromSnapshot(raw, "pro"),
      client_renews_annually: raw.client_renews_annually,
      renewal_interval_months: raw.renewal_interval_months ?? null,
      renewal_anchor_date: raw.renewal_anchor_date ?? null,
    };
  }
  if (isBookingInvoiceSnapshotV1(raw)) {
    return {
      invoice_number: null,
      invoice_date_iso: raw.paid_at,
      paid_at_iso: raw.paid_at,
      supplier_legal_name: raw.business_name,
      supplier_address: "",
      supplier_gst_display: PLACEHOLDER_TAX,
      supplier_qst_display: PLACEHOLDER_TAX,
      professional_name: raw.business_name,
      pro_profile_id: raw.pro_profile_id,
      service_description: [raw.service_name, raw.duration_label, raw.appointment_summary].filter(Boolean).join(" — "),
      appointment_summary: raw.appointment_summary,
      preferred_date: raw.preferred_date ?? null,
      preferred_time: raw.preferred_time ?? null,
      customer_address: "—",
      subtotal: raw.subtotal,
      gst: raw.gst,
      qst: raw.qst,
      processing_fee: raw.processing_fee,
      total_cents: raw.total_cents,
      currency: raw.currency,
      payment_method_label: "—",
      square_payment_id: raw.square_payment_id ?? null,
      booking_id: bookingId,
      booking_reference_code: publicCodeFromSnapshot(raw) ?? refFromRow,
      client_member_number: memberNumberFromSnapshot(raw, "client"),
      pro_member_number: memberNumberFromSnapshot(raw, "pro"),
      client_renews_annually: raw.client_renews_annually,
      renewal_interval_months: raw.renewal_interval_months ?? null,
      renewal_anchor_date: raw.renewal_anchor_date ?? null,
    };
  }
  return null;
}

function memberNumberFromSnapshot(raw: unknown, role: "client" | "pro"): string | null {
  if (!raw || typeof raw !== "object") return null;
  const key = role === "client" ? "client_member_number" : "pro_member_number";
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function buildServiceDescriptionDetailed(params: {
  serviceLine: string;
  durationLabel?: string | null;
  serviceAbout?: string | null;
}): string {
  const parts = [params.serviceLine.trim()];
  if (params.durationLabel?.trim()) parts.push(params.durationLabel.trim());
  const about = params.serviceAbout?.trim();
  if (about) parts.push(about);
  return parts.join(" — ");
}

export function buildBookingInvoiceSnapshotV2(params: {
  proProfileId: string;
  businessName: string;
  supplierLegalName: string;
  supplierAddress: string;
  supplierGstNumber?: string | null;
  supplierQstNumber?: string | null;
  serviceName: string;
  serviceDescriptionDetailed: string;
  durationLabel?: string | null;
  appointmentSummary: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceDurationMinutes?: number | null;
  serviceCategorySlug?: string | null;
  serviceSlug?: string | null;
  customerAddress: string;
  baseAmountCents: number;
  currency: string;
  squarePaymentId?: string | null;
  idempotencyKey?: string | null;
  paymentMethodLabel: string;
  clientRenewsAnnually?: boolean;
  renewalIntervalMonths?: number | null;
  renewalAnchorDate?: string | null;
  paidAt?: string;
  clientMemberNumber?: string | null;
  proMemberNumber?: string | null;
}): BookingInvoiceSnapshotV2 {
  const amounts = computeBookingInvoiceFromBaseCents(params.baseAmountCents);
  const base: BookingInvoiceSnapshotV1 = {
    v: BOOKING_INVOICE_SNAPSHOT_V1,
    paid_at: params.paidAt ?? new Date().toISOString(),
    pro_profile_id: params.proProfileId,
    business_name: params.businessName,
    service_name: params.serviceName,
    duration_label: params.durationLabel ?? null,
    appointment_summary: params.appointmentSummary,
    preferred_date: params.preferredDate ?? null,
    preferred_time: params.preferredTime ?? null,
    service_duration_minutes: params.serviceDurationMinutes ?? null,
    service_category_slug: params.serviceCategorySlug ?? null,
    service_slug: params.serviceSlug ?? null,
    currency: params.currency.toUpperCase().slice(0, 3),
    base_amount_cents: params.baseAmountCents,
    subtotal: amounts.subtotal,
    gst: amounts.gst,
    qst: amounts.qst,
    processing_fee: amounts.processingFee,
    total_cents: amounts.totalCents,
    square_payment_id: params.squarePaymentId ?? null,
    idempotency_key: params.idempotencyKey ?? null,
    client_renews_annually: params.clientRenewsAnnually,
    renewal_interval_months: params.renewalIntervalMonths ?? null,
    renewal_anchor_date: params.renewalAnchorDate ?? null,
    client_member_number: params.clientMemberNumber?.trim() || null,
    pro_member_number: params.proMemberNumber?.trim() || null,
  };
  return {
    ...base,
    v: BOOKING_INVOICE_SNAPSHOT_V2,
    invoice_number: null,
    supplier_legal_name: params.supplierLegalName.trim() || params.businessName.trim(),
    supplier_address: params.supplierAddress.trim(),
    supplier_gst_number: params.supplierGstNumber?.trim() || null,
    supplier_qst_number: params.supplierQstNumber?.trim() || null,
    service_description_detailed: params.serviceDescriptionDetailed.trim() || params.serviceName.trim(),
    customer_address: params.customerAddress.trim() || "Non fourni / Not provided",
    payment_method_label: params.paymentMethodLabel.trim() || "—",
  };
}

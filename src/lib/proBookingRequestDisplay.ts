import type { Locale } from "@/contexts/LanguageContext";

export type ProBookingRequestRow = {
  id: string;
  created_at: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  service_duration_minutes?: number | null;
  status: string;
  client_id: string;
  decline_reason?: string | null;
  responded_at?: string | null;
  service_category_slug?: string | null;
  service_slug?: string | null;
  invoice_snapshot?: unknown;
  public_booking_code?: string | null;
  service_location_choice?: string | null;
  distance_km_snapshot?: number | null;
  drive_minutes_snapshot?: number | null;
  pro_unread?: boolean | null;
};
import { serviceCategories } from "@/data/services";
import { labelProService, catalogEnNameForProService } from "@/lib/proServiceLabel";
import { normalizeBookingInvoiceSnapshot } from "@/lib/bookingInvoiceSnapshot";

export function proBookingServiceLabel(
  booking: { service_category_slug?: string | null; service_slug?: string | null },
  locale: Locale,
): string | null {
  const cat = booking.service_category_slug?.trim();
  const slug = booking.service_slug?.trim();
  if (!cat || !slug) return null;
  return labelProService(
    { service_slug: slug, display_name: null },
    locale,
    catalogEnNameForProService(cat, slug, serviceCategories),
  );
}

export function proBookingAmountDisplay(
  booking: { id: string; invoice_snapshot?: unknown; public_booking_code?: string | null },
): string | null {
  const norm = normalizeBookingInvoiceSnapshot(booking.id, booking.invoice_snapshot, {
    fallbackBookingPublicCode: booking.public_booking_code ?? undefined,
  });
  if (!norm) return null;
  return `${(norm.total_cents / 100).toFixed(2)} ${norm.currency}`;
}

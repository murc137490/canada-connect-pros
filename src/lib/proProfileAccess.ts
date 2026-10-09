import { untypedDb } from "@/lib/untypedSupabase";

/**
 * pro_profiles column access (security review 2026-10-08, HIGH 1).
 *
 * anon + authenticated only have column-level SELECT on the public-safe columns below.
 * Private columns (phone, business_address, street-level location, exact latitude/longitude,
 * ID documents, approval baseline, SMS templates, tax numbers, unavailable_dates /
 * available_date_overrides, …) are read through SECURITY DEFINER RPCs:
 *   - get_my_pro_profile()            → the signed-in pro's own full row
 *   - admin_get_pro_profiles(p_ids)   → full rows for platform moderators
 *   - get_pro_billing_details(p_ids)  → invoice supplier fields for signed-in clients
 *   - get_pro_open_slots(id, from, to) → public OPEN booking windows (no client data)
 * Never use select("*") on pro_profiles from the browser; list columns explicitly.
 */
export const PUBLIC_PRO_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "business_name",
  "bio",
  // City-level only (generated from the private `location`, street addresses stripped).
  "location_city",
  "years_experience",
  "price_min",
  "price_max",
  "availability",
  "is_verified",
  "primary_category_slug",
  "service_tags",
  "banner_image_url",
  "pro_accent_color",
  "page_template",
  "page_header_text",
  "page_primary_color",
  "page_secondary_color",
  "page_background_color",
  "page_accent_color",
  "service_at_workspace_only",
  "service_radius_km",
  "offers_travel",
  "offers_workspace",
  "subscription_tier",
  "square_location_id",
  "share_slug",
  "pro_member_id",
  "booking_cancel_policy",
  "booking_cancel_fee_percent",
  // Weekly opening hours only. Blocked dates/times and other clients' bookings are private:
  // the booking UI asks get_pro_open_slots() for open windows instead.
  "created_at",
  // Rounded to 2 decimals (~1 km) by generated columns; exact coords stay private.
  "latitude_approx",
  "longitude_approx",
] as const;

export const PUBLIC_PRO_PROFILE_SELECT = PUBLIC_PRO_PROFILE_COLUMNS.join(", ");

type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null };

/** The signed-in user's own pro_profiles row (any columns). `columns` defaults to all. */
export async function fetchMyProProfile<T = Record<string, unknown>>(columns = "*"): Promise<RpcResult<T>> {
  const res = await untypedDb.rpc("get_my_pro_profile").select(columns).maybeSingle();
  return { data: (res.data as T | null) ?? null, error: res.error };
}

/** Platform moderators only: full pro_profiles rows. Pass `ids` to filter, or omit for all. */
export async function fetchProProfilesAsAdmin<T = Record<string, unknown>>(
  columns = "*",
  ids?: string[] | null,
): Promise<RpcResult<T[]>> {
  const res = await untypedDb
    .rpc("admin_get_pro_profiles", { p_ids: ids && ids.length ? ids : null })
    .select(columns)
    .order("created_at", { ascending: false });
  return { data: (res.data as T[] | null) ?? null, error: res.error };
}

export type ProBillingDetails = {
  id: string;
  legal_business_name: string | null;
  business_address: string | null;
  location: string | null;
  gst_registration_number: string | null;
  qst_registration_number: string | null;
};

/**
 * Invoice supplier fields (legal name, business address, GST/QST). Only returned to the pro
 * themself, admins, or a client who already has a booking or payment with that pro. At checkout
 * the bookings trigger fills these into invoice_snapshot server-side, so callers must not rely on
 * this before the booking/payment exists (use fetchProBillingReady() for the pre-payment check).
 */
export async function fetchProBillingDetails(ids: string[]): Promise<Record<string, ProBillingDetails>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await untypedDb.rpc("get_pro_billing_details", { p_pro_profile_ids: unique });
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, ProBillingDetails> = {};
  for (const row of data as ProBillingDetails[]) out[row.id] = row;
  return out;
}

/** Pre-payment check: does the pro have an invoice address on file? (no address is returned) */
export async function fetchProBillingReady(proId: string): Promise<boolean | null> {
  if (!proId) return null;
  const { data, error } = await untypedDb.rpc("pro_billing_ready", { p_pro_profile_id: proId });
  if (error) return null; // unknown (e.g. migration not applied): don't block checkout
  return data === true;
}

/** Map the rounded public coords onto latitude/longitude for code that expects those keys. */
export function withApproxCoords<T extends { latitude_approx?: number | null; longitude_approx?: number | null }>(
  row: T,
): T & { latitude: number | null; longitude: number | null } {
  return {
    ...row,
    latitude: row.latitude_approx ?? null,
    longitude: row.longitude_approx ?? null,
  };
}

export type ProOpenWindow = { slot_date: string; start_time: string; end_time: string; grid_start_min: number };

/** date (YYYY-MM-DD) → open windows in minutes, plus the day's schedule start for the hourly grid. */
export type ProOpenSlotsByDate = Record<string, { gridStartMin: number; windows: { start: number; end: number }[] }>;

const hhmmToMin = (s: string): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/**
 * Public open booking windows for a pro (weekly hours minus blocked times minus every active
 * booking, computed server-side). Returns null if the RPC failed (caller may retry).
 */
export async function fetchProOpenSlots(
  proProfileId: string,
  fromDate: string,
  toDate: string,
): Promise<ProOpenSlotsByDate | null> {
  const { data, error } = await untypedDb.rpc("get_pro_open_slots", {
    p_pro_profile_id: proProfileId,
    p_from: fromDate,
    p_to: toDate,
  });
  if (error || !Array.isArray(data)) return null;
  const out: ProOpenSlotsByDate = {};
  for (const row of data as ProOpenWindow[]) {
    const start = hhmmToMin(row.start_time);
    const end = hhmmToMin(row.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const day = (out[row.slot_date] ??= { gridStartMin: row.grid_start_min ?? start, windows: [] });
    day.windows.push({ start, end });
  }
  return out;
}

/** True when the server rejected a booking because the slot was just taken (trigger SLOT_TAKEN). */
export function isSlotTakenError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "23P01" || /SLOT_TAKEN/i.test(err.message ?? "");
}

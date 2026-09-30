/**
 * A pro's own jobs, read one at a time like voicemail.
 * Landmark answers come only from a map lookup, never from the model guessing.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Snap = Record<string, unknown>;

export type ProRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  pro_member_id: string | null;
  phone: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  preferred_date: string | null;
  preferred_time: string | null;
  public_booking_code: string | null;
  service_slug: string | null;
  service_category_slug: string | null;
  service_duration_minutes: number | null;
  invoice_snapshot: Snap | null;
  client_id: string | null;
  pro_profile_id: string;
};

const BOOKING_COLUMNS =
  "id, status, preferred_date, preferred_time, public_booking_code, service_slug, service_category_slug, service_duration_minutes, invoice_snapshot, client_id, pro_profile_id";

function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function phonesMatch(stored: string | null | undefined, e164Digits: string): boolean {
  const p = digits(String(stored ?? ""));
  if (!p || !e164Digits) return false;
  const last10 = e164Digits.slice(-10);
  return p === e164Digits || (last10.length === 10 && p.slice(-10) === last10);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

function streetKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(rue|street|st|avenue|ave|av|boulevard|boul|blvd|chemin|ch|road|rd)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function money(snap: Snap | null): { subtotal_cad: number | null; total_cad: number | null; currency: string } {
  const s = snap ?? {};
  const totalCents = Number(s.total_cents);
  const subtotalCents = Number(s.subtotal_cents);
  const subtotal = Number(s.subtotal);
  const total =
    Number.isFinite(totalCents) && totalCents > 0
      ? Math.round(totalCents) / 100
      : Number.isFinite(subtotal) && subtotal > 0
        ? subtotal
        : null;
  const sub =
    Number.isFinite(subtotalCents) && subtotalCents > 0
      ? Math.round(subtotalCents) / 100
      : Number.isFinite(subtotal) && subtotal > 0
        ? subtotal
        : null;
  return {
    subtotal_cad: sub,
    total_cad: total,
    currency: String(s.currency ?? "CAD"),
  };
}

function serviceLabel(booking: BookingRow): string {
  const snap = booking.invoice_snapshot ?? {};
  const named = String(snap.service_name ?? snap.service_label ?? "").trim();
  return named || booking.service_slug || "service";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function findProByUserId(admin: SupabaseClient, userId: string): Promise<ProRow | null> {
  const { data } = await admin
    .from("pro_profiles")
    .select("id, user_id, business_name, pro_member_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProRow | null) ?? null;
}

export async function findProByPhone(admin: SupabaseClient, e164: string): Promise<ProRow | null> {
  const target = digits(e164);
  const { data } = await admin
    .from("pro_profiles")
    .select("id, user_id, business_name, pro_member_id, phone")
    .not("phone", "is", null)
    .limit(500);
  const hit = (data ?? []).find((row) => phonesMatch(String(row.phone ?? ""), target));
  return (hit as ProRow | undefined) ?? null;
}

async function clientAddress(admin: SupabaseClient, booking: BookingRow): Promise<string | null> {
  const fromInvoice = String(booking.invoice_snapshot?.customer_address ?? "").trim();
  if (fromInvoice) return fromInvoice;
  if (!booking.client_id) return null;
  const { data } = await admin
    .from("profiles")
    .select("address, postal_code")
    .eq("user_id", booking.client_id)
    .maybeSingle();
  const line = [data?.address, data?.postal_code, "Canada"].filter((p) => String(p ?? "").trim()).join(", ");
  return line.trim() || null;
}

async function loadOwnedBookings(admin: SupabaseClient, proProfileId: string): Promise<BookingRow[]> {
  const { data, error } = await admin
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("pro_profile_id", proProfileId)
    .in("status", ["pending", "accepted"])
    .order("preferred_date", { ascending: true })
    .order("preferred_time", { ascending: true });
  if (error) throw new Error(error.message);
  const today = todayIso();
  const rows = (data ?? []) as BookingRow[];
  const pending = rows.filter((b) => b.status === "pending");
  const upcoming = rows.filter(
    (b) => b.status === "accepted" && (!b.preferred_date || String(b.preferred_date) >= today),
  );
  return [...pending, ...upcoming];
}

function summary(booking: BookingRow, index: number) {
  return {
    index,
    booking_code: booking.public_booking_code,
    status: booking.status,
    service: serviceLabel(booking),
    date: booking.preferred_date,
    time: booking.preferred_time ? String(booking.preferred_time).slice(0, 5) : null,
  };
}

export async function listProBookings(admin: SupabaseClient, pro: ProRow) {
  const rows = await loadOwnedBookings(admin, pro.id);
  const pending = rows.filter((b) => b.status === "pending");
  const upcoming = rows.filter((b) => b.status === "accepted");
  return {
    ok: true,
    business_name: pro.business_name,
    pending_count: pending.length,
    upcoming_count: upcoming.length,
    jobs: rows.map((b, i) => summary(b, i + 1)),
    queue_ids: rows.map((b) => b.id),
    instruction:
      "Tell them the pending count first. Ask if they want to hear the jobs, one at a time, like voicemail. Do not read an address until they say yes. Then call read_pro_booking with index 1.",
  };
}

async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  formatted: string;
  street: string | null;
} | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  if (key) {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(address) +
      "&components=country:CA&key=" +
      encodeURIComponent(key);
    const res = await fetch(url);
    const body = await res.json().catch(() => null) as {
      status?: string;
      results?: {
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
        address_components?: { long_name: string; types: string[] }[];
      }[];
    } | null;
    const hit = body?.status === "OK" ? body.results?.[0] : null;
    const loc = hit?.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      const street = hit?.address_components?.find((c) => c.types.includes("route"))?.long_name ?? null;
      return { lat: loc.lat, lng: loc.lng, formatted: hit?.formatted_address ?? address, street };
    }
  }
  const nom = await fetch(
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&q=" +
      encodeURIComponent(address),
    { headers: { "User-Agent": "AltShift-FrontDesk/1.0 (https://www.altshift.ca)", Accept: "application/json" } },
  );
  const rows = await nom.json().catch(() => []) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: { road?: string };
  }[];
  const row = rows[0];
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, formatted: row?.display_name ?? address, street: row?.address?.road ?? null };
}

type PlaceHit = { name: string; distance_m: number; address: string | null; street: string | null };

/** Quebec listings often use the French brand name (KFC is PFK). */
function placeAliases(keyword: string): string[] {
  const k = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const groups: string[][] = [
    ["kfc", "pfk", "poulet frit kentucky"],
    ["tim hortons", "tim horton"],
    ["mcdonalds", "mcdo", "mcdonald"],
    ["starbucks"],
    ["subway"],
    ["walmart"],
    ["iga"],
    ["metro"],
    ["pharmaprix", "shoppers"],
  ];
  for (const group of groups) {
    if (group.some((g) => k.includes(g))) return group;
  }
  return [keyword.trim()];
}

async function nearbyPlaces(lat: number, lng: number, keyword: string | null, radius: number): Promise<PlaceHit[]> {
  const aliases = keyword ? placeAliases(keyword) : [];
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  if (key && keyword) {
    const url =
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" +
      `${lat},${lng}&radius=${radius}&keyword=` +
      encodeURIComponent(keyword) +
      "&key=" +
      encodeURIComponent(key);
    const res = await fetch(url);
    const body = await res.json().catch(() => null) as {
      status?: string;
      results?: {
        name?: string;
        vicinity?: string;
        geometry?: { location?: { lat: number; lng: number } };
      }[];
    } | null;
    if (body?.status === "OK" && body.results?.length) {
      return body.results.slice(0, 5).map((r) => {
        const plat = r.geometry?.location?.lat ?? lat;
        const plng = r.geometry?.location?.lng ?? lng;
        return {
          name: String(r.name ?? keyword),
          distance_m: haversineMeters(lat, lng, plat, plng),
          address: r.vicinity ?? null,
          street: null,
        };
      }).sort((a, b) => a.distance_m - b.distance_m);
    }
  }

  const aliasPattern = aliases
    .map((a) => a.replace(/["\\]/g, "").replace(/[.*+?^${}()|[\]\\]/g, "."))
    .filter(Boolean)
    .join("|");
  const nameFilter = aliasPattern
    ? `["name"~"${aliasPattern}",i]`
    : `["name"]["amenity"]`;
  const query =
    `[out:json][timeout:12];(` +
    `node(around:${radius},${lat},${lng})${nameFilter};` +
    `way(around:${radius},${lat},${lng})${nameFilter};` +
    `);out center 12;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "AltShift-FrontDesk/1.0" },
    body: "data=" + encodeURIComponent(query),
  });
  const body = await res.json().catch(() => null) as {
    elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
  } | null;
  const hits: PlaceHit[] = [];
  for (const el of body?.elements ?? []) {
    const name = el.tags?.name;
    if (!name) continue;
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (plat == null || plng == null) continue;
    hits.push({
      name,
      distance_m: haversineMeters(lat, lng, plat, plng),
      address: el.tags?.["addr:street"]
        ? [el.tags["addr:housenumber"], el.tags["addr:street"]].filter(Boolean).join(" ")
        : null,
      street: el.tags?.["addr:street"] ?? null,
    });
  }
  if (keyword && hits.length === 0) {
    const delta = Math.max(radius, 400) / 111000;
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
    for (const alias of aliases.slice(0, 3)) {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&bounded=1&viewbox=" +
        encodeURIComponent(viewbox) +
        "&q=" +
        encodeURIComponent(alias);
      const nom = await fetch(url, {
        headers: { "User-Agent": "AltShift-FrontDesk/1.0 (https://www.altshift.ca)", Accept: "application/json" },
      });
      const rows = await nom.json().catch(() => []) as {
        lat?: string;
        lon?: string;
        display_name?: string;
        name?: string;
        address?: { road?: string };
      }[];
      for (const row of rows) {
        const plat = Number(row.lat);
        const plng = Number(row.lon);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
        const distance_m = haversineMeters(lat, lng, plat, plng);
        if (distance_m > radius) continue;
        hits.push({
          name: row.name || alias,
          distance_m,
          address: row.display_name ?? null,
          street: row.address?.road ?? null,
        });
      }
      if (hits.length) break;
    }
  }
  hits.sort((a, b) => a.distance_m - b.distance_m);
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const id = `${h.name}|${h.distance_m}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unique.slice(0, keyword ? 5 : 4);
}

async function bookingByIndexOrCode(
  admin: SupabaseClient,
  pro: ProRow,
  args: { index?: number; booking_code?: string; queue_ids?: string[] },
): Promise<{ booking: BookingRow; index: number; total: number } | null> {
  const rows = await loadOwnedBookings(admin, pro.id);
  if (!rows.length) return null;
  const code = String(args.booking_code ?? "").trim().toUpperCase();
  if (code) {
    const i = rows.findIndex((b) => String(b.public_booking_code ?? "").toUpperCase() === code);
    if (i < 0) return null;
    return { booking: rows[i], index: i + 1, total: rows.length };
  }
  const index = Number(args.index ?? 1);
  if (!Number.isFinite(index) || index < 1 || index > rows.length) return null;
  return { booking: rows[index - 1], index, total: rows.length };
}

export async function readProBooking(
  admin: SupabaseClient,
  pro: ProRow,
  args: { index?: number; booking_code?: string },
) {
  const found = await bookingByIndexOrCode(admin, pro, args);
  if (!found) return { ok: false, error: "job_not_found" };
  const { booking, index, total } = found;
  const address = await clientAddress(admin, booking);
  const price = money(booking.invoice_snapshot);
  const clientName = String(booking.invoice_snapshot?.client_name ?? "").trim() || null;
  let nearby: PlaceHit[] = [];
  let located = false;
  if (address) {
    const geo = await geocodeAddress(address);
    if (geo) {
      located = true;
      nearby = await nearbyPlaces(geo.lat, geo.lng, null, 450);
    }
  }
  return {
    ok: true,
    index,
    total,
    booking_code: booking.public_booking_code,
    status: booking.status,
    status_say: booking.status === "pending" ? "waiting for you to accept" : "already accepted",
    service: serviceLabel(booking),
    date: booking.preferred_date,
    time: booking.preferred_time ? String(booking.preferred_time).slice(0, 5) : null,
    duration_minutes: booking.service_duration_minutes,
    client_name: clientName,
    address,
    ...price,
    map_located: located,
    nearby_places: nearby.map((p) => ({ name: p.name, distance_m: p.distance_m })),
    instruction:
      "Read this one job: service, date, time, address, and total. Mention a nearby place only if it is in nearby_places. Then ask if they want the next one. If they name a place that is not in nearby_places, call check_booking_landmark. Never invent a landmark.",
  };
}

export async function checkBookingLandmark(
  admin: SupabaseClient,
  pro: ProRow,
  args: { index?: number; booking_code?: string; place_name?: string },
) {
  const place = String(args.place_name ?? "").trim();
  if (place.length < 2) return { ok: false, error: "missing_place_name" };
  const found = await bookingByIndexOrCode(admin, pro, args);
  if (!found) return { ok: false, error: "job_not_found" };
  const address = await clientAddress(admin, found.booking);
  if (!address) {
    return {
      ok: true,
      found: false,
      reason: "no_address",
      instruction: "This job has no street address on file. Say that. Do not guess a landmark.",
    };
  }
  const geo = await geocodeAddress(address);
  if (!geo) {
    return {
      ok: true,
      found: false,
      address,
      reason: "geocode_failed",
      instruction: "Repeat the street address. Say you could not check that place on the map. Do not guess.",
    };
  }
  const hits = await nearbyPlaces(geo.lat, geo.lng, place, 1200);
  const best = hits[0];
  if (!best) {
    return {
      ok: true,
      found: false,
      address: geo.formatted,
      place_name: place,
      searched_within_m: 1200,
      instruction: "Say you cannot confirm that place near this job. Repeat the street address. Do not guess.",
    };
  }
  const bookingStreet = streetKey(geo.street);
  const placeStreet = streetKey(best.street ?? best.address);
  const same =
    bookingStreet && placeStreet ? placeStreet.includes(bookingStreet) || bookingStreet.includes(placeStreet) : null;
  return {
    ok: true,
    found: true,
    place_name: best.name,
    distance_m: best.distance_m,
    place_address: best.address,
    booking_address: geo.formatted,
    booking_street: geo.street,
    same_street: same,
    instruction:
      "Answer only from these fields. Say how far the place is. Say it is the same street only when same_street is true. If same_street is null, do not claim it is or is not that street.",
  };
}

type DeskSession = {
  id: string;
  authenticated: boolean;
  customer_user_id: string | null;
  draft: Record<string, unknown>;
};

async function requirePro(admin: SupabaseClient, session: DeskSession): Promise<ProRow | { error: string; message: string }> {
  if (!session.authenticated || !session.customer_user_id) {
    return { error: "not_authenticated", message: "Authenticate with a voice PIN or Pro ID plus the text code first." };
  }
  const pro = await findProByUserId(admin, session.customer_user_id);
  if (!pro) return { error: "not_a_pro", message: "This account is not a professional." };
  return pro;
}

export async function callerProFields(admin: SupabaseClient, userId: string) {
  const pro = await findProByUserId(admin, userId);
  if (!pro) return { is_pro: false as const };
  return {
    is_pro: true as const,
    business_name: pro.business_name,
    pro_member_id: pro.pro_member_id,
    pro_profile_id: pro.id,
  };
}

export async function handleProTool(
  admin: SupabaseClient,
  session: DeskSession,
  name: string,
  args: Record<string, unknown>,
  deps: {
    patch: (patch: Record<string, unknown>) => Promise<void>;
    sendOtp: (phone: string) => Promise<{ ok: boolean; error?: string }>;
    checkOtp: (phone: string, code: string) => Promise<{ ok: boolean; error?: string }>;
    toE164: (raw: string) => string | null;
  },
): Promise<unknown | null> {
  if (name !== "authenticate_pro" && name !== "list_pro_bookings" && name !== "read_pro_booking" && name !== "check_booking_landmark") {
    return null;
  }

  if (name === "authenticate_pro") {
    const proId = String(args.pro_id ?? "").replace(/\D/g, "").slice(-4).padStart(4, "0");
    const action = String(args.action ?? "send_otp");
    const { data: pro } = await admin
      .from("pro_profiles")
      .select("id, user_id, business_name, pro_member_id, phone")
      .eq("pro_member_id", proId)
      .maybeSingle();
    if (!pro) return { ok: false, error: "pro_not_found", message: "No professional found for that Pro ID." };
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", pro.user_id)
      .maybeSingle();
    const phone = deps.toE164(String(profile?.phone ?? pro.phone ?? ""));
    if (!phone) return { ok: false, error: "no_phone", message: "This pro account has no phone number on file for a code." };

    if (action === "send_otp") {
      const demo = Deno.env.get("FRONT_DESK_DEMO_OTP") === "1" || !Deno.env.get("TELNYX_API_KEY");
      if (demo) {
        await deps.patch({
          customer_user_id: pro.user_id,
          otp_sent_at: new Date().toISOString(),
          draft: { ...session.draft, demo_otp: "000000", phone, pro_profile_id: pro.id },
        });
        return { ok: true, demo: true, message: "Code sent. Demo code is 000000." };
      }
      const sent = await deps.sendOtp(phone);
      if (!sent.ok) return { ok: false, error: "otp_send_failed", detail: sent.error };
      await deps.patch({
        customer_user_id: pro.user_id,
        otp_sent_at: new Date().toISOString(),
        draft: { ...session.draft, phone, pro_profile_id: pro.id },
      });
      return { ok: true, message: "I've sent a six-digit code to the phone number on the pro account." };
    }

    if (action === "check_otp") {
      const code = String(args.otp_code ?? "").replace(/\D/g, "");
      const draftPhone = String(session.draft?.phone ?? phone);
      const demoCode = String(session.draft?.demo_otp ?? "");
      const passed = (demoCode && code === demoCode) || (await deps.checkOtp(draftPhone, code)).ok;
      if (!passed) return { ok: false, error: "otp_invalid" };
      await deps.patch({
        authenticated: true,
        otp_verified_at: new Date().toISOString(),
        customer_user_id: pro.user_id,
        draft: { ...session.draft, auth_method: "pro_otp", pro_profile_id: pro.id, role: "pro" },
      });
      return {
        ok: true,
        authenticated: true,
        is_pro: true,
        name: profile?.full_name ?? pro.business_name,
        business_name: pro.business_name,
        pro_member_id: pro.pro_member_id,
      };
    }
    return { error: "bad_action" };
  }

  const pro = await requirePro(admin, session);
  if ("error" in pro) return pro;
  try {
    if (name === "list_pro_bookings") return await listProBookings(admin, pro);
    if (name === "read_pro_booking") {
      return await readProBooking(admin, pro, {
        index: args.index != null ? Number(args.index) : undefined,
        booking_code: args.booking_code ? String(args.booking_code) : undefined,
      });
    }
    return await checkBookingLandmark(admin, pro, {
      index: args.index != null ? Number(args.index) : undefined,
      booking_code: args.booking_code ? String(args.booking_code) : undefined,
      place_name: args.place_name ? String(args.place_name) : undefined,
    });
  } catch (e) {
    return { ok: false, error: "pro_jobs_failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

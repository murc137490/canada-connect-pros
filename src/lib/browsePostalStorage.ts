import { distanceKm } from "@/lib/geocode";

export const BROWSE_POSTAL_STORAGE_KEY = "premiere:browsePostal";
export const BROWSE_POSTAL_CHANGED_EVENT = "premiere-browse-postal-changed";

export type BrowsePostalPayload = {
  postal: string;
  lat: number;
  lng: number;
  city?: string | null;
  province?: string | null;
  savedAt: string;
};

export function getBrowsePostalLocation(): BrowsePostalPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BROWSE_POSTAL_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<BrowsePostalPayload>;
    if (
      typeof o.postal !== "string" ||
      typeof o.lat !== "number" ||
      typeof o.lng !== "number" ||
      !Number.isFinite(o.lat) ||
      !Number.isFinite(o.lng)
    ) {
      return null;
    }
    return {
      postal: o.postal.trim(),
      lat: o.lat,
      lng: o.lng,
      city: o.city ?? null,
      province: o.province ?? null,
      savedAt: typeof o.savedAt === "string" ? o.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

const BROWSE_POSTAL_COOKIE = "premiere_browse_postal";

function setBrowsePostalCookie(postal: string): void {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(postal.trim().slice(0, 12));
  document.cookie = `${BROWSE_POSTAL_COOKIE}=${v}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function clearBrowsePostalCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${BROWSE_POSTAL_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setBrowsePostalLocation(payload: Omit<BrowsePostalPayload, "savedAt">): void {
  if (typeof window === "undefined") return;
  const full: BrowsePostalPayload = { ...payload, savedAt: new Date().toISOString() };
  window.localStorage.setItem(BROWSE_POSTAL_STORAGE_KEY, JSON.stringify(full));
  setBrowsePostalCookie(full.postal);
  window.dispatchEvent(new Event(BROWSE_POSTAL_CHANGED_EVENT));
}

/** Clears saved browse postal (localStorage + cookie). */
export function clearBrowsePostalLocation(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BROWSE_POSTAL_STORAGE_KEY);
  clearBrowsePostalCookie();
  window.dispatchEvent(new Event(BROWSE_POSTAL_CHANGED_EVENT));
}

/** Whether a verified pro's coordinates fall within their service radius of the client's point. */
export function isProServingPoint(
  clientLat: number,
  clientLng: number,
  pro: {
    latitude: number | null;
    longitude: number | null;
    service_radius_km: number | null;
  }
): "yes" | "no" | "no_coords" {
  if (pro.latitude == null || pro.longitude == null) return "no_coords";
  const d = distanceKm(clientLat, clientLng, pro.latitude, pro.longitude);
  const r = pro.service_radius_km ?? 50;
  return d <= r ? "yes" : "no";
}

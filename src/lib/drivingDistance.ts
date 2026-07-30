import { distanceKm } from "@/lib/geocode";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as
  | string
  | undefined;

export type DrivingLegResult = {
  distanceKm: number;
  durationMinutes: number;
};

/**
 * Driving distance and duration via Google Distance Matrix (car).
 * Falls back to straight-line km and ~2 min/km estimate if the API is unavailable.
 */
export async function fetchDrivingLeg(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DrivingLegResult | null> {
  const straight = distanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  if (!Number.isFinite(straight)) return null;

  if (!API_KEY) {
    return {
      distanceKm: Math.round(straight * 10) / 10,
      durationMinutes: Math.max(1, Math.round(straight * 2)),
    };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destinations", `${destination.lat},${destination.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("units", "metric");
    url.searchParams.set("key", API_KEY);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status?: string;
      rows?: { elements?: { status?: string; distance?: { value?: number }; duration?: { value?: number } }[] }[];
    };

    const el = data.rows?.[0]?.elements?.[0];
    if (data.status === "OK" && el?.status === "OK" && el.distance?.value != null && el.duration?.value != null) {
      return {
        distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
        durationMinutes: Math.max(1, Math.round(el.duration.value / 60)),
      };
    }
  } catch (err) {
    console.warn("Distance Matrix error:", err);
  }

  return {
    distanceKm: Math.round(straight * 10) / 10,
    durationMinutes: Math.max(1, Math.round(straight * 2)),
  };
}

export function isWithinServiceRadius(distanceKmValue: number, radiusKm: number | null | undefined): boolean {
  const r = radiusKm ?? 50;
  return distanceKmValue <= r;
}

/** Driving time label: under 60 min → "45 min"; from 60 min → "1h 41min". */
export function formatDriveDurationLabel(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return m === 1 ? "1 min" : `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}min`;
}

import { fetchDrivingLeg, formatDriveDurationLabel, isWithinServiceRadius } from "@/lib/drivingDistance";
import { geocodeAddress } from "@/lib/geocode";
import {
  bookingUsesTravelDistance,
  resolveBookingLocationChoice,
  type ProLocationProfile,
  type ServiceLocationChoice,
  type ServiceLocationMode,
} from "@/lib/serviceLocationMode";

export type BookingTravelSnapshot = {
  service_location_choice: ServiceLocationChoice;
  distance_km_snapshot: number | null;
  drive_minutes_snapshot: number | null;
};

export type TravelDistanceCheck =
  | { status: "not_travel" }
  | { status: "ok"; snapshot: BookingTravelSnapshot; distanceKm: number; durationMinutes: number }
  | {
      status: "outside_radius";
      distanceKm: number;
      durationMinutes: number;
      radiusKm: number;
    }
  | { status: "error"; message: string };

export async function checkTravelDistanceForBooking(args: {
  pro: ProLocationProfile & {
    latitude?: number | null;
    longitude?: number | null;
    service_radius_km?: number | null;
  };
  mode: ServiceLocationMode;
  clientChoice: ServiceLocationChoice | null | undefined;
  clientAddressForGeocode: string;
  /** When set (e.g. browse postal used by the distance preview), skip address geocode. */
  clientLatLng?: { lat: number; lng: number } | null;
}): Promise<TravelDistanceCheck> {
  const choice = resolveBookingLocationChoice(args.mode, args.clientChoice);

  if (!bookingUsesTravelDistance(args.mode, choice)) {
    return { status: "not_travel" };
  }

  if (args.pro.latitude == null || args.pro.longitude == null) {
    return { status: "error", message: "This professional has not set a service area yet." };
  }

  let clientLat: number | null = args.clientLatLng?.lat ?? null;
  let clientLng: number | null = args.clientLatLng?.lng ?? null;

  if (clientLat == null || clientLng == null) {
    const addr = args.clientAddressForGeocode.trim();
    if (!addr) {
      return { status: "error", message: "Add your address in Dashboard → My account before booking travel services." };
    }
    const clientGeo = await geocodeAddress(addr);
    if (!clientGeo) {
      return { status: "error", message: "We could not verify your address. Check it in My account and try again." };
    }
    clientLat = clientGeo.lat;
    clientLng = clientGeo.lng;
  }

  const leg = await fetchDrivingLeg(
    { lat: args.pro.latitude, lng: args.pro.longitude },
    { lat: clientLat, lng: clientLng },
  );
  if (!leg) {
    return { status: "error", message: "Could not estimate travel distance. Try again later." };
  }

  const radiusKm = args.pro.service_radius_km ?? 50;
  if (!isWithinServiceRadius(leg.distanceKm, args.pro.service_radius_km)) {
    return {
      status: "outside_radius",
      distanceKm: leg.distanceKm,
      durationMinutes: leg.durationMinutes,
      radiusKm,
    };
  }

  return {
    status: "ok",
    distanceKm: leg.distanceKm,
    durationMinutes: leg.durationMinutes,
    snapshot: {
      service_location_choice: choice,
      distance_km_snapshot: leg.distanceKm,
      drive_minutes_snapshot: leg.durationMinutes,
    },
  };
}

export async function resolveBookingTravelSnapshot(args: {
  pro: ProLocationProfile & {
    latitude?: number | null;
    longitude?: number | null;
    service_radius_km?: number | null;
  };
  mode: ServiceLocationMode;
  clientChoice: ServiceLocationChoice | null | undefined;
  clientAddressForGeocode: string;
}): Promise<{ ok: true; snapshot: BookingTravelSnapshot } | { ok: false; message: string }> {
  const result = await checkTravelDistanceForBooking(args);
  if (result.status === "not_travel") {
    const choice = resolveBookingLocationChoice(args.mode, args.clientChoice);
    return {
      ok: true,
      snapshot: {
        service_location_choice: choice,
        distance_km_snapshot: null,
        drive_minutes_snapshot: null,
      },
    };
  }
  if (result.status === "ok") {
    return { ok: true, snapshot: result.snapshot };
  }
  if (result.status === "outside_radius") {
    return {
      ok: false,
      message: `You are about ${Math.round(result.distanceKm)} km away (~${formatDriveDurationLabel(result.durationMinutes)} by car). This pro serves within ${result.radiusKm} km.`,
    };
  }
  return { ok: false, message: result.message };
}

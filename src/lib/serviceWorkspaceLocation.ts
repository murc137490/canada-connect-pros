import type { ServiceLocationMode } from "@/lib/serviceLocationMode";

export type ServiceWorkspaceSource = {
  location_mode?: string | null;
  workspace_address?: string | null;
  workspace_latitude?: number | null;
  workspace_longitude?: number | null;
};

export type ProWorkspaceFallback = {
  business_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
};

/** Resolved map point for “at my workspace” distance (service address, else pro business / pin). */
export function resolveServiceWorkspaceCoords(
  service: ServiceWorkspaceSource | null | undefined,
  pro: ProWorkspaceFallback | null | undefined,
): { lat: number; lng: number; addressLabel: string } | null {
  if (service?.workspace_latitude != null && service?.workspace_longitude != null) {
    return {
      lat: service.workspace_latitude,
      lng: service.workspace_longitude,
      addressLabel: service.workspace_address?.trim() || "",
    };
  }
  if (pro?.latitude != null && pro?.longitude != null) {
    return {
      lat: pro.latitude,
      lng: pro.longitude,
      addressLabel:
        service?.workspace_address?.trim() ||
        pro.business_address?.trim() ||
        pro.location?.trim() ||
        "",
    };
  }
  return null;
}

export function serviceModeNeedsWorkspaceAddress(mode: string): boolean {
  return mode === "workspace" || mode === "both";
}

export function shouldShowWorkspaceDistancePreview(
  mode: ServiceLocationMode,
  choice: "workspace" | "travel",
): boolean {
  if (mode === "workspace") return true;
  if (mode === "both" && choice === "workspace") return true;
  return false;
}

export function shouldShowTravelDistancePreview(
  mode: ServiceLocationMode,
  choice: "workspace" | "travel",
): boolean {
  if (mode === "travel") return true;
  if (mode === "both" && choice === "travel") return true;
  return false;
}

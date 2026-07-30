export type ServiceLocationMode = "workspace" | "travel" | "both";
export type ServiceLocationChoice = "workspace" | "travel";

export type ProLocationProfile = {
  service_at_workspace_only?: boolean | null;
  offers_workspace?: boolean | null;
  offers_travel?: boolean | null;
};

export function profileOffers(profile: ProLocationProfile): { offersWorkspace: boolean; offersTravel: boolean } {
  if (profile.offers_workspace != null || profile.offers_travel != null) {
    return {
      offersWorkspace: profile.offers_workspace === true,
      offersTravel: profile.offers_travel === true,
    };
  }
  const workspaceOnly = profile.service_at_workspace_only === true;
  return { offersWorkspace: true, offersTravel: !workspaceOnly };
}

/** Legacy column kept in sync on save. */
export function legacyServiceAtWorkspaceOnly(offersWorkspace: boolean, offersTravel: boolean): boolean {
  return offersWorkspace && !offersTravel;
}

export function profileDefaultMode(profile: ProLocationProfile): ServiceLocationMode {
  const { offersWorkspace, offersTravel } = profileOffers(profile);
  if (offersWorkspace && offersTravel) return "both";
  if (offersTravel) return "travel";
  return "workspace";
}

export function effectiveServiceLocationMode(
  profile: ProLocationProfile,
  service: { location_mode?: string | null } | null | undefined,
): ServiceLocationMode {
  const m = service?.location_mode?.trim();
  if (m === "workspace" || m === "travel" || m === "both") return m;
  return profileDefaultMode(profile);
}

export function resolveBookingLocationChoice(
  mode: ServiceLocationMode,
  clientChoice: ServiceLocationChoice | null | undefined,
): ServiceLocationChoice {
  if (mode === "workspace") return "workspace";
  if (mode === "travel") return "travel";
  return clientChoice === "travel" ? "travel" : "workspace";
}

export function bookingUsesTravelDistance(
  mode: ServiceLocationMode,
  choice: ServiceLocationChoice,
): boolean {
  if (mode === "workspace") return false;
  if (mode === "travel") return true;
  return choice === "travel";
}

export function proMapLocationMode(
  offersWorkspace: boolean,
  offersTravel: boolean,
): ServiceLocationMode {
  if (offersWorkspace && offersTravel) return "both";
  if (offersTravel) return "travel";
  return "workspace";
}

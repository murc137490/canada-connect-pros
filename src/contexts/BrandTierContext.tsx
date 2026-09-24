import { createContext, useContext, type ReactNode } from "react";
import type { PwaIconTier } from "@/lib/pwaIconTheme";
import { PWA_ICON_THEMES } from "@/lib/pwaIconTheme";

const BrandTierContext = createContext<PwaIconTier>("client");

export function BrandTierProvider({
  tier,
  children,
}: {
  tier: PwaIconTier;
  children: ReactNode;
}) {
  return <BrandTierContext.Provider value={tier}>{children}</BrandTierContext.Provider>;
}

/** Active brand / favicon tier for the signed-in user (client = B&W / signed out). */
export function useBrandTier(): PwaIconTier {
  return useContext(BrandTierContext);
}

/**
 * Transparent-A monogram path.
 * @param surface onDark = bright S (footer); onLight = darker S; auto = caller decides via theme
 */
export function brandLogoPathFor(
  tier: PwaIconTier,
  surface: "onDark" | "onLight" | "auto" = "auto",
): string {
  const theme = PWA_ICON_THEMES[tier] ?? PWA_ICON_THEMES.client;
  if (surface === "onLight") return theme.brandLogoOnLight;
  return theme.brandLogo;
}

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

export function useBrandLogoSrc(): string {
  const tier = useBrandTier();
  return PWA_ICON_THEMES[tier]?.brandLogo ?? PWA_ICON_THEMES.client.brandLogo;
}

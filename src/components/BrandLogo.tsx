import { useTheme } from "next-themes";
import { brandLogoPathFor, useBrandTier } from "@/contexts/BrandTierContext";
import { BRAND_ICON_CACHE_VER } from "@/lib/pwaIconTheme";

type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * auto — follow color scheme (light page → darker S; dark page → bright/tier S)
   * onDark — force bright S (footer)
   * onLight — force darker S
   *
   * A is always transparent so it reads as the page background
   * (white in light mode, black in dark mode).
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift SA monogram — see-through A, gradient S (tier colors when subscribed).
 */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
  tone = "auto",
}: BrandLogoProps) {
  const tier = useBrandTier();
  const { resolvedTheme } = useTheme();
  const isLightUi =
    tone === "onLight" ? true : tone === "onDark" ? false : resolvedTheme !== "dark";

  const src = brandLogoPathFor(tier, isLightUi ? "onLight" : "onDark");
  const href = `${src}?v=${BRAND_ICON_CACHE_VER}&t=${tier}&s=${isLightUi ? "l" : "d"}`;

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <img
        key={href}
        src={href}
        alt=""
        width={64}
        height={64}
        className={`shrink-0 object-contain ${className}`}
        decoding="async"
      />
      {withWordmark ? <span className={`block truncate ${wordmarkClassName}`}>AltShift</span> : null}
    </span>
  );
}

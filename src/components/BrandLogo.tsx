import { useBrandLogoSrc, useBrandTier } from "@/contexts/BrandTierContext";
import { BRAND_ICON_CACHE_VER } from "@/lib/pwaIconTheme";

type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * Kept for call-site compatibility. Assets are black A + gradient S —
   * no invert, so the A never flips to white.
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift SA monogram — black A + gradient S (tier colors when subscribed).
 */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
}: BrandLogoProps) {
  const tier = useBrandTier();
  const src = useBrandLogoSrc();
  // Cache-bust so Android Chrome / Samsung don't keep a stale B&W mark.
  const href = `${src}?v=${BRAND_ICON_CACHE_VER}&t=${tier}`;

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

import { useBrandLogoSrc, useBrandTier } from "@/contexts/BrandTierContext";

type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * auto — light mode: light A / dark S; dark mode: dark A / light S (B&W only)
   * onDark — dark A / light S (footer, dark surfaces; B&W only)
   * onLight — light A / dark S (forced light-surface look; B&W only)
   *
   * Paid tiers use a pre-colored cutout and skip invert filters.
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift SA monogram — B&W when signed out / client; tier colors when subscribed.
 */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
  tone = "auto",
}: BrandLogoProps) {
  const tier = useBrandTier();
  const src = useBrandLogoSrc();
  const isClient = tier === "client";
  const toneClass = !isClient
    ? ""
    : tone === "onDark"
      ? ""
      : tone === "onLight"
        ? "invert"
        : "invert dark:invert-0";

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <img
        src={src}
        alt=""
        width={64}
        height={64}
        className={`shrink-0 object-contain ${toneClass} ${className}`}
        decoding="async"
      />
      {withWordmark ? <span className={`block truncate ${wordmarkClassName}`}>AltShift</span> : null}
    </span>
  );
}

import { useBrandLogoSrc } from "@/contexts/BrandTierContext";

type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * Kept for call-site compatibility. Assets are black A + light/tier S —
   * no invert, so the A never flips to white.
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift SA monogram — black A + light/tier-colored S.
 * Signed out / client = B&W; subscribed = tier-colored S.
 */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
}: BrandLogoProps) {
  const src = useBrandLogoSrc();

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <img
        src={src}
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

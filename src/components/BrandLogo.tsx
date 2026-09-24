type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * auto — light mode: light A / dark S; dark mode: dark A / light S
   * onDark — dark A / light S (footer, dark surfaces)
   * onLight — light A / dark S (forced light-surface look)
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift SA monogram.
 * Base asset is dark A + light S; inverted for light mode.
 */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
  tone = "auto",
}: BrandLogoProps) {
  const toneClass =
    tone === "onDark" ? "" : tone === "onLight" ? "invert" : "invert dark:invert-0";

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <img
        src="/altshift-logo-transparent.png"
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

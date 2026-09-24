type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * auto — light mode: black mark; dark mode: white mark
   * onDark — white mark (footer, dark surfaces)
   * onLight — black mark (forced light-surface look)
   */
  tone?: "auto" | "onDark" | "onLight";
};

/**
 * AltShift AS monogram (white mark on transparent).
 * Inverted for light surfaces so the mark reads dark.
 */
export default function BrandLogo({
  className = "h-10 w-10",
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

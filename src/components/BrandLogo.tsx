type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  /**
   * auto — light mode: dark A / light S; dark mode: light A / dark S
   * inverted — always light A / dark S (dark surfaces like the footer)
   * light — always dark A / light S
   */
  tone?: "auto" | "inverted" | "light";
};

/** AltShift SA monogram — A and S swap weight with theme. */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
  tone = "auto",
}: BrandLogoProps) {
  const toneClass =
    tone === "inverted" ? "invert" : tone === "light" ? "" : "dark:invert";

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

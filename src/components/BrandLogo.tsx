type BrandLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** AltShift SA monogram — dark A, lighter S. */
export default function BrandLogo({
  className = "h-8 w-8",
  withWordmark = false,
  wordmarkClassName = "font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground",
}: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <img
        src="/altshift-logo-transparent.png"
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

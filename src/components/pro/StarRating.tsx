import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  className?: string;
  /** @deprecated Kept for call-site compat; stars are always bare (no light-surface pill). */
  emptyStarsLightSurface?: boolean;
}

/**
 * Gauge-style stars: each star fills left→right by the fractional rating (e.g. 4.3 → four full + 30% of the fifth).
 */
export default function StarRating({
  rating,
  maxRating = 5,
  size = 18,
  interactive = false,
  onRate,
  className,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(maxRating, Number.isFinite(rating) ? rating : 0));

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${clamped} / ${maxRating}`}>
      {Array.from({ length: maxRating }, (_, i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        const pct = `${Math.round(fill * 1000) / 10}%`;

        if (interactive) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onRate?.(i + 1)}
              className="relative shrink-0 cursor-pointer transition-transform hover:scale-110"
              aria-label={`${i + 1}`}
            >
              <Star size={size} className="fill-muted/40 text-muted-foreground/35" strokeWidth={1.5} />
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{ width: i < clamped ? "100%" : "0%" }}
              >
                <Star size={size} className="fill-amber-500 text-amber-500" strokeWidth={1.5} />
              </span>
            </button>
          );
        }

        return (
          <span key={i} className="relative inline-block shrink-0 leading-none" style={{ width: size, height: size }}>
            <Star
              size={size}
              className="absolute inset-0 fill-transparent text-amber-500/35"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="absolute inset-0 overflow-hidden" style={{ width: pct }} aria-hidden>
              <Star size={size} className="fill-amber-500 text-amber-500" strokeWidth={1.75} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

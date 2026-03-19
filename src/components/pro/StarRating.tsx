import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  className?: string;
}

export default function StarRating({
  rating,
  maxRating = 5,
  size = 18,
  interactive = false,
  onRate,
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: maxRating }, (_, i) => {
        const filled = i < Math.floor(rating);
        const halfFilled = !filled && i < rating;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(i + 1)}
            className={cn(
              "transition-colors",
              interactive && "cursor-pointer hover:scale-110",
              !interactive && "cursor-default"
            )}
          >
            <Star
              size={size}
              className={cn(
                filled
                  ? "fill-amber-500 text-amber-500"
                  : halfFilled
                  ? "fill-amber-500/50 text-amber-500"
                  : "fill-muted text-muted-foreground/30"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

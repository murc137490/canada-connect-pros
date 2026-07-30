import { Link } from "react-router-dom";
import { Heart, ShieldCheck, DollarSign } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "./StarRating";
import ShinyText from "@/components/ShinyText";
import { cn } from "@/lib/utils";
export interface ProCardData {
  id: string;
  businessName: string;
  fullName: string;
  avatarUrl?: string | null;
  location?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  avgRating: number;
  reviewCount: number;
  isVerified: boolean;
  hasLicense: boolean;
  serviceSlug: string;
  categorySlug: string;
  /** Distance in km from search location (when sorted by proximity) */
  distanceKm?: number | null;
}

interface ProCardProps {
  pro: ProCardData;
  className?: string;
  highlight?: boolean;
  /** Saved / heart state for logged-in clients */
  isFavorite?: boolean;
  onFavoriteClick?: (e: React.MouseEvent) => void;
  favoriteDisabled?: boolean;
}

export default function ProCard({ pro, className, highlight, isFavorite, onFavoriteClick, favoriteDisabled }: ProCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const initials = pro.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  const showHeart = onFavoriteClick != null;

  return (
    <div
      className={cn(
        "relative flex gap-4 p-4 rounded-2xl border bg-card card-hover",
        highlight && "ring-2 ring-secondary",
        className
      )}
    >
      {showHeart && (
        <button
          type="button"
          disabled={favoriteDisabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteClick(e);
          }}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 hover:bg-muted/80 transition-colors disabled:opacity-50"
          title={isFavorite ? "Remove from saved" : "Save pro"}
          aria-pressed={isFavorite}
        >
          <Heart
            className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500")}
            strokeWidth={isFavorite ? 0 : 2}
          />
        </button>
      )}
    <Link
      to={`/pros/${pro.id}`}
      className="flex gap-4 flex-1 min-w-0 pr-8"
    >
      <Avatar className="w-16 h-16 shrink-0">
        <AvatarImage src={pro.avatarUrl || undefined} alt={pro.fullName} />
        <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-heading font-bold text-card-foreground truncate">
            <ShinyText
              text={pro.businessName}
              speed={2.5}
              color={isDark ? "#fff" : "#0f0f0f"}
              shineColor={isDark ? "#0f0f0f" : "#fff"}
              spread={100}
              className={cn("font-heading font-bold", isDark ? "text-white" : "text-[#0f0f0f]")}
            />
          </h3>
          {pro.hasLicense && (
            <ShieldCheck size={16} className="text-green-600 dark:text-green-400 shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{pro.fullName}</p>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-1">
            <StarRating rating={pro.avgRating} size={14} />
            <span className="text-xs text-muted-foreground">
              ({pro.reviewCount})
            </span>
          </div>

          {(pro.priceMin || pro.priceMax) && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
              <DollarSign size={12} />
              {pro.priceMin && pro.priceMax
                ? `$${pro.priceMin} – $${pro.priceMax}`
                : pro.priceMin
                ? `From $${pro.priceMin}`
                : `Up to $${pro.priceMax}`}
            </span>
          )}
        </div>
      </div>
    </Link>
    </div>
  );
}

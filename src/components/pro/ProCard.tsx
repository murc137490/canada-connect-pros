import { Link } from "react-router-dom";
import { MapPin, ShieldCheck, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "./StarRating";
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
}

interface ProCardProps {
  pro: ProCardData;
  className?: string;
  highlight?: boolean;
}

export default function ProCard({ pro, className, highlight }: ProCardProps) {
  const initials = pro.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <Link
      to={`/pros/${pro.id}`}
      className={cn(
        "flex gap-4 p-4 rounded-2xl border bg-card card-hover",
        highlight && "ring-2 ring-secondary",
        className
      )}
    >
      <Avatar className="w-16 h-16 shrink-0">
        <AvatarImage src={pro.avatarUrl || undefined} alt={pro.fullName} />
        <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-heading font-bold text-card-foreground truncate">{pro.businessName}</h3>
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

          {pro.location && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {pro.location}
            </span>
          )}

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
  );
}

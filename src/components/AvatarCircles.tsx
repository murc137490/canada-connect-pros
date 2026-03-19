import { Link } from "react-router-dom";

export interface AvatarItem {
  imageUrl: string;
  profileUrl?: string;
}

interface AvatarCirclesProps {
  numPeople: number;
  avatarUrls: AvatarItem[];
  className?: string;
  /** Max number of avatar circles to show (default 6) */
  maxAvatars?: number;
  size?: "sm" | "md" | "lg";
  /** Optional: override "X pros available" text (e.g. for i18n) */
  otherLabel?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

export default function AvatarCircles({
  numPeople,
  avatarUrls,
  className = "",
  maxAvatars = 6,
  size = "md",
  otherLabel,
}: AvatarCirclesProps) {
  const displayAvatars = avatarUrls.slice(0, maxAvatars);
  const s = sizeClasses[size];
  const label = otherLabel ?? `${numPeople} ${numPeople === 1 ? "pro" : "pros"} available`;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <div className="flex -space-x-2">
        {displayAvatars.map((item, i) => {
          const content = (
            <div
              key={i}
              className={`${s} rounded-full border-2 border-white dark:border-gray-900 bg-muted overflow-hidden shrink-0 ring-1 ring-border`}
              style={{ marginLeft: i === 0 ? 0 : "-0.5rem" }}
              title={String(numPeople)}
            >
              <img
                src={item.imageUrl || PLACEHOLDER_AVATAR}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_AVATAR; }}
              />
            </div>
          );
          return item.profileUrl ? (
            <Link
              to={item.profileUrl}
              key={i}
              className="block hover:opacity-90 transition-opacity"
              style={{ marginLeft: i === 0 ? 0 : "-0.5rem" }}
            >
              {content}
            </Link>
          ) : (
            <span key={i}>{content}</span>
          );
        })}
      </div>
      <span className="text-sm text-muted-foreground font-medium">
        {label}
      </span>
    </div>
  );
}

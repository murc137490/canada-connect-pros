import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface LicenseBadgeProps {
  licenseNumber: string;
  licenseType: string;
  isVerified: boolean;
  className?: string;
}

export default function LicenseBadge({ licenseNumber, licenseType, isVerified, className }: LicenseBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border",
        isVerified
          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
        className
      )}
    >
      {isVerified ? (
        <ShieldCheck size={14} className="shrink-0" />
      ) : (
        <ShieldAlert size={14} className="shrink-0" />
      )}
      <span>
        {licenseType} #{licenseNumber} — {isVerified ? "Verified" : "Pending"}
      </span>
    </div>
  );
}

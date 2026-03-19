import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface MagicCardProps {
  children: React.ReactNode;
  className?: string;
  gradientColor?: string;
}

export default function MagicCard({
  children,
  className = "",
  gradientColor,
}: MagicCardProps) {
  const { resolvedTheme } = useTheme();
  const color =
    gradientColor ??
    (resolvedTheme === "dark" ? "#262626" : "rgba(217, 217, 217, 0.33)");

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border border-border/50",
        className
      )}
      style={{
        boxShadow: `0 0 0 1px transparent, 0 0 24px -4px ${color}`,
        background: `linear-gradient(135deg, ${color}22 0%, transparent 50%, ${color}11 100%)`,
      }}
    >
      {children}
    </div>
  );
}

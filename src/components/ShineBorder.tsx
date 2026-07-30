import { useTheme } from "next-themes";

interface ShineBorderProps {
  children: React.ReactNode;
  className?: string;
  shineColor?: string[];
}

/** Thin animated border: gradient lives only in the padding ring (not a full-card overlay). */
export default function ShineBorder({
  children,
  className = "",
  shineColor,
}: ShineBorderProps) {
  const { resolvedTheme } = useTheme();
  const colors =
    shineColor ??
    (resolvedTheme === "dark"
      ? ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"]
      : ["#1e3a5f", "#0d9488", "#f59e0b"]);

  const c1 = colors[0];
  const c2 = colors[1] ?? c1;
  const c3 = colors[2] ?? c1;

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-px ${className}`}
      style={{
        backgroundImage: `linear-gradient(110deg, transparent 15%, ${c1} 40%, ${c2} 50%, ${c3} 60%, transparent 85%)`,
        backgroundSize: "220% 220%",
        animation: "shine-border 3s ease-in-out infinite",
      }}
    >
      <div className="relative min-h-full overflow-hidden rounded-[calc(0.75rem-1px)] bg-background dark:bg-card">
        {children}
      </div>
    </div>
  );
}

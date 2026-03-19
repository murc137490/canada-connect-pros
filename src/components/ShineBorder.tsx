import { useTheme } from "next-themes";

interface ShineBorderProps {
  children: React.ReactNode;
  className?: string;
  shineColor?: string[];
}

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

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        ["--shine-color-1" as string]: colors[0],
        ["--shine-color-2" as string]: colors[1] ?? colors[0],
        ["--shine-color-3" as string]: colors[2] ?? colors[0],
      }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-100"
        style={{
          background: `linear-gradient(115deg, transparent 25%, var(--shine-color-1) 45%, var(--shine-color-2) 55%, var(--shine-color-3) 65%, transparent 75%)`,
          backgroundSize: "250% 250%",
          animation: "shine-border 3s ease-in-out infinite",
        }}
      />
      <div className="relative rounded-[10px] bg-background dark:bg-card m-[2px]">
        {children}
      </div>
    </div>
  );
}

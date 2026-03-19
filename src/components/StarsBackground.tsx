import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface StarsBackgroundProps {
  starColor?: string;
  className?: string;
  children?: React.ReactNode;
}

// Seeded random for stable star positions across renders
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export default function StarsBackground({
  starColor = "#FFF",
  className,
  children,
}: StarsBackgroundProps) {
  const stars = useMemo(() => {
    const count = 120;
    return Array.from({ length: count }, (_, i) => {
      const seed = i * 1.337;
      return {
        left: `${seededRandom(seed) * 100}%`,
        top: `${seededRandom(seed + 1) * 100}%`,
        size: seededRandom(seed + 2) < 0.2 ? 2 : 1,
        opacity: 0.4 + seededRandom(seed + 3) * 0.6,
      };
    });
  }, []);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden
    >
      <div className="absolute inset-0">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              backgroundColor: starColor,
              opacity: s.opacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}

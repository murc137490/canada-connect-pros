import { useRef } from "react";
import "./SpotlightCard.css";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  /** Full gradient string for ::before (e.g. purple + orange). Uses var(--mouse-x) and var(--mouse-y). */
  spotlightGradient?: string;
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(234, 187, 31, 0.25)",
  spotlightGradient,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    divRef.current.style.setProperty("--mouse-x", `${x}px`);
    divRef.current.style.setProperty("--mouse-y", `${y}px`);
    if (!spotlightGradient) {
      divRef.current.style.setProperty("--spotlight-color", spotlightColor);
    }
  };

  const gradientStyle = spotlightGradient
    ? { ["--spotlight-gradient" as string]: spotlightGradient }
    : undefined;

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${spotlightGradient ? "card-spotlight--gradient" : ""} ${className}`.trim()}
      style={gradientStyle}
    >
      <div className="card-spotlight-inner">{children}</div>
    </div>
  );
}


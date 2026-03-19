import { useState, useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import "./GradientText.css";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: "horizontal" | "vertical" | "diagonal";
  pauseOnHover?: boolean;
  yoyo?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#5227FF", "#FF9FFC", "#B19EEF"],
  animationSpeed = 8,
  showBorder = false,
  direction = "horizontal",
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animationDuration = animationSpeed * 1000;

  useEffect(() => {
    let rafId: number;
    const tick = (time: number) => {
      if (isPaused) {
        lastTimeRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      elapsedRef.current += deltaTime;
      if (yoyo) {
        const fullCycle = animationDuration * 2;
        const cycleTime = elapsedRef.current % fullCycle;
        if (cycleTime < animationDuration) {
          progress.set((cycleTime / animationDuration) * 100);
        } else {
          progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
        }
      } else {
        progress.set((elapsedRef.current / animationDuration) * 100);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, yoyo, animationDuration, progress]);

  const backgroundPosition = useTransform(progress, (p) => {
    if (direction === "horizontal") return `${p}% 50%`;
    if (direction === "vertical") return `50% ${p}%`;
    return `${p}% 50%`;
  });

  const gradientAngle =
    direction === "horizontal" ? "to right" : direction === "vertical" ? "to bottom" : "to bottom right";
  const gradientColors = [...colors, colors[0]].join(", ");
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === "horizontal" ? "300% 100%" : direction === "vertical" ? "100% 300%" : "300% 300%",
    backgroundRepeat: "repeat",
  };

  return (
    <motion.div
      className={`animated-gradient-text ${showBorder ? "with-border" : ""} ${className}`.trim()}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      {showBorder && (
        <motion.div className="gradient-overlay" style={{ ...gradientStyle, backgroundPosition }} />
      )}
      <motion.div className="gradient-text-content" style={{ ...gradientStyle, backgroundPosition }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

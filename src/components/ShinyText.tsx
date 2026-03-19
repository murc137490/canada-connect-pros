import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  delay?: number;
}

export default function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = "",
  color = "#b5b5b5",
  shineColor = "#ffffff",
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = "left",
  delay = 0,
}: ShinyTextProps) {
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);
  const [isPaused, setIsPaused] = useState(false);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
  }, [direction]);

  useEffect(() => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }
    let rafId: number;
    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      elapsedRef.current += deltaTime;
      if (yoyo) {
        const cycleDuration = animationDuration + delayDuration;
        const fullCycle = cycleDuration * 2;
        const cycleTime = elapsedRef.current % fullCycle;
        if (cycleTime < animationDuration) {
          const p = (cycleTime / animationDuration) * 100;
          progress.set(directionRef.current === 1 ? p : 100 - p);
        } else if (cycleTime < cycleDuration) {
          progress.set(directionRef.current === 1 ? 100 : 0);
        } else if (cycleTime < cycleDuration + animationDuration) {
          const reverseTime = cycleTime - cycleDuration;
          const p = 100 - (reverseTime / animationDuration) * 100;
          progress.set(directionRef.current === 1 ? p : 100 - p);
        } else {
          progress.set(directionRef.current === 1 ? 0 : 100);
        }
      } else {
        const cycleDuration = animationDuration + delayDuration;
        const cycleTime = elapsedRef.current % cycleDuration;
        if (cycleTime < animationDuration) {
          const p = (cycleTime / animationDuration) * 100;
          progress.set(directionRef.current === 1 ? p : 100 - p);
        } else {
          progress.set(directionRef.current === 1 ? 100 : 0);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [disabled, isPaused, yoyo, animationDuration, delayDuration, progress]);

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  return (
    <motion.span
      className={`shiny-text ${className}`}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      {text}
    </motion.span>
  );
}

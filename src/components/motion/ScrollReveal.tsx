import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/motion/types";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

type Props = {
  className?: string;
  children: ReactNode;
  delay?: number;
  y?: number;
  /** Stay visible after first enter. Default false = fade out when leaving. */
  once?: boolean;
  /** How much of the element must be visible ("some", "all", or 0–1 fraction). */
  amount?: "some" | "all" | number;
  /** Shrink/expand the viewport for enter/leave. Defaults to 80% active viewport zone with 20% fade buffer. */
  margin?: string;
};

/**
 * Appear / disappear when scrolling in and out of view.
 * 80% of the screen displays clear, active content; the small 20% (10% top, 10% bottom)
 * provides the smooth fade-in / fade-away transition zone.
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 10,
  once = false,
  amount = "some",
  margin = "-5% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once,
    amount,
    margin: margin as "-5% 0px",
  });
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: Math.round(y * 0.45) }}
      transition={{ duration: 0.26, delay, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}

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
  /** How much of the element must be visible (0–1). */
  amount?: number;
  /** Shrink/expand the viewport for enter/leave. */
  margin?: string;
};

/**
 * Appear / disappear when scrolling in and out of view.
 * Uses IntersectionObserver — not per-frame scroll scrubbing.
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 28,
  once = false,
  amount = 0.25,
  margin = "-18% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once,
    amount,
    margin: margin as "-18% 0px",
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
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: Math.round(y * 0.55) }}
      transition={{ duration: MOTION.reveal, delay, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}

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
  /** Shrink/expand the viewport for enter/leave. */
  margin?: string;
};

/**
 * Stickify-style scroll appear: opacity + blur + slight rise.
 * Clears in the middle of the viewport; softens again when leaving (unless once).
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 28,
  once = false,
  amount = 0.35,
  margin = "-12% 0px -18% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once,
    amount,
    margin: margin as "-12% 0px -18% 0px",
  });
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y, filter: "blur(14px)", scale: 0.98 }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }
          : { opacity: 0, y: Math.round(y * 0.55), filter: "blur(10px)", scale: 0.985 }
      }
      transition={{ duration: 0.55, delay, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}

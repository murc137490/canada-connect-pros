import { useEffect, useRef, useState } from "react";
import { motion, useInView, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/motion/types";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

type Props = HTMLMotionProps<"div"> & {
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  /**
   * Fraction of the element that must be visible (0–1).
   * Default 0.2; use ~0.3 with a -30% bottom margin so large sections
   * read as “fully on” around the 70% viewport line.
   */
  amount?: number;
  /** IntersectionObserver root margin override. */
  margin?: string;
};

export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 8,
  once = false,
  amount,
  margin,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const resolvedAmount = amount ?? (once ? 0.12 : 0.22);
  // Default: count as in-view once the element crosses ~70% down the viewport
  // (bottom 30% of the root is ignored). Exit uses hysteresis below.
  const resolvedMargin = margin ?? (once ? "0px 0px -20% 0px" : "0px 0px -30% 0px");

  const rawInView = useInView(ref, {
    once,
    margin: resolvedMargin as `${number}px ${number}px ${number}px ${number}px`,
    amount: resolvedAmount,
  });
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (once) {
      if (rawInView) setInView(true);
      return;
    }
    if (rawInView) {
      setInView(true);
      return;
    }
    // Delay exit so threshold chatter at section edges doesn't blink.
    const t = window.setTimeout(() => setInView(false), 180);
    return () => window.clearTimeout(t);
  }, [rawInView, once]);

  if (reduced) {
    return (
      <div className={className} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{
        duration: MOTION.reveal,
        delay: inView ? delay : 0,
        ease: MOTION.ease,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

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
  amount?: number;
  margin?: string;
};

/**
 * Soft scroll reveal — never fully invisible, so sections don’t pop from blank.
 * Enter: slight slide + fade up to full. Exit (if not once): ease down, stay readable.
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 10,
  once = false,
  amount,
  margin,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const resolvedAmount = amount ?? 0.15;
  const resolvedMargin = margin ?? "0px 0px -20% 0px";

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
    const t = window.setTimeout(() => setInView(false), 200);
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
      initial={{ opacity: 0.55, y }}
      animate={
        inView
          ? { opacity: 1, y: 0 }
          : { opacity: once ? 1 : 0.55, y: once ? 0 : y * 0.45 }
      }
      transition={{
        duration: 0.55,
        delay: inView ? delay : 0,
        ease: MOTION.ease,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

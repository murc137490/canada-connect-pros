import { useRef } from "react";
import { motion, useInView, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/motion/types";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

type Props = HTMLMotionProps<"div"> & {
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
};

export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 8,
  once = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once,
    // Slight inset only — items appear/disappear with much less scroll travel
    margin: once ? "-4% 0px" : "-6% 0px -8% 0px",
    amount: once ? 0.12 : 0.2,
  });
  const reduced = usePrefersReducedMotion();

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
      transition={{ duration: MOTION.reveal, delay: inView ? delay : 0, ease: MOTION.ease }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

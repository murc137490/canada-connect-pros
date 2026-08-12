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
  y = 22,
  once = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once,
    // Wide exit band so mid-height items don't flicker at the threshold
    margin: once ? "-8% 0px" : "-18% 0px -22% 0px",
    amount: once ? 0.15 : 0.45,
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

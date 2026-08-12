import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

type Props = {
  className?: string;
  children: React.ReactNode;
  delay?: number;
  y?: number;
  /** Kept for API compat; always one-shot for performance. */
  once?: boolean;
  amount?: number;
  margin?: string;
};

/**
 * Lightweight one-shot CSS appear. No Framer scroll listeners / continuous transforms.
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 8,
  margin = "0px 0px -15% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [inView, setInView] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, margin]);

  return (
    <div
      ref={ref}
      className={cn("home-soft-appear", inView && "home-soft-appear--in", className)}
      style={
        {
          "--home-soft-y": `${y}px`,
          "--home-soft-delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

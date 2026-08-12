import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useInViewToggle } from "@/hooks/useInViewToggle";

type Props = {
  className?: string;
  children: React.ReactNode;
  delay?: number;
  y?: number;
  /** Stay visible after first enter. Default false = fade out when leaving. */
  once?: boolean;
  amount?: number;
  margin?: string;
};

/**
 * Soft appear / disappear via IntersectionObserver + CSS.
 * No Framer scroll scrubbing — cheap for normal devices.
 */
export default function ScrollReveal({
  className,
  children,
  delay = 0,
  y = 10,
  once = false,
  margin = "0px 0px -12% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewToggle(ref, {
    once,
    rootMargin: margin,
    enterAt: 0.2,
    leaveAt: 0.06,
  });
  const animating = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    animating.current = true;
    el.classList.add("home-soft-appear--busy");
    const done = () => {
      animating.current = false;
      el.classList.remove("home-soft-appear--busy");
    };
    el.addEventListener("transitionend", done);
    const t = window.setTimeout(done, 700);
    return () => {
      el.removeEventListener("transitionend", done);
      window.clearTimeout(t);
    };
  }, [inView]);

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

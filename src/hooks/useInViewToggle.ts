import { useEffect, useRef, useState, type RefObject } from "react";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

type Options = {
  /** Enter when at least this much of the element is visible. */
  enterAt?: number;
  /** Leave when visibility drops to this or below (hysteresis vs enterAt). */
  leaveAt?: number;
  rootMargin?: string;
  /** If true, stay visible after first enter. */
  once?: boolean;
};

/**
 * Cheap enter/leave visibility for CSS transitions.
 * No scroll scrubbing — only flips state at intersection thresholds.
 */
export function useInViewToggle(
  ref: RefObject<Element | null>,
  {
    enterAt = 0.22,
    leaveAt = 0.08,
    rootMargin = "0px 0px -12% 0px",
    once = false,
  }: Options = {}
) {
  const reduced = usePrefersReducedMotion();
  const [inView, setInView] = useState(reduced);
  const onceRef = useRef(once);
  onceRef.current = once;

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const thresholds = Array.from(new Set([0, leaveAt, enterAt, 0.35, 0.5, 0.75, 1])).sort(
      (a, b) => a - b
    );

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const r = entry.intersectionRatio;
        if (r >= enterAt) {
          setInView(true);
          if (onceRef.current) io.disconnect();
        } else if (r <= leaveAt) {
          if (!onceRef.current) setInView(false);
        }
      },
      { rootMargin, threshold: thresholds }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [ref, reduced, enterAt, leaveAt, rootMargin]);

  return inView;
}

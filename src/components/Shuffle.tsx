import React, { useRef, useState, useCallback } from "react";
import { gsap } from "gsap";

interface ShuffleProps {
  text: string;
  className?: string;
  shuffleDirection?: "right" | "left" | "up" | "down";
  duration?: number;
  ease?: string;
  stagger?: number;
  animationMode?: "evenodd" | "random";
  triggerOnHover?: boolean;
  respectReducedMotion?: boolean;
  tag?: keyof JSX.IntrinsicElements;
}

export default function Shuffle({
  text,
  className = "",
  shuffleDirection = "right",
  duration = 0.35,
  ease = "power3.out",
  stagger = 0.03,
  animationMode = "evenodd",
  triggerOnHover = true,
  respectReducedMotion = true,
  tag: Tag = "span",
}: ShuffleProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const playedRef = useRef(false);

  const runAnimation = useCallback(() => {
    if (respectReducedMotion && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setReady(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (playedRef.current) return; // only one run at a time
    playedRef.current = true;
    const wrappers = el.querySelectorAll(".shuffle-char-wrapper");
    if (!wrappers.length) {
      setReady(true);
      return;
    }
    const isVertical = shuffleDirection === "up" || shuffleDirection === "down";
    const fromX = shuffleDirection === "right" ? -20 : shuffleDirection === "left" ? 20 : 0;
    const fromY = shuffleDirection === "down" ? -20 : shuffleDirection === "up" ? 20 : 0;
    const arr = Array.from(wrappers);
    const tl = gsap.timeline({
      onComplete: () => {
      setReady(true);
      playedRef.current = false; // allow replay on next hover
    },
    });
    if (animationMode === "evenodd") {
      const odd = arr.filter((_, i) => i % 2 === 1);
      const even = arr.filter((_, i) => i % 2 === 0);
      odd.forEach((w, i) => {
        const inner = w.querySelector(".shuffle-inner") as HTMLElement;
        if (!inner) return;
        const at = i * stagger;
        if (isVertical) tl.fromTo(inner, { y: fromY }, { y: 0, duration, ease, delay: at }, 0);
        else tl.fromTo(inner, { x: fromX }, { x: 0, duration, ease, delay: at }, 0);
      });
      even.forEach((w, i) => {
        const inner = w.querySelector(".shuffle-inner") as HTMLElement;
        if (!inner) return;
        const at = duration * 0.5 + i * stagger;
        if (isVertical) tl.fromTo(inner, { y: fromY }, { y: 0, duration, ease, delay: at }, 0);
        else tl.fromTo(inner, { x: fromX }, { x: 0, duration, ease, delay: at }, 0);
      });
    } else {
      arr.forEach((w, i) => {
        const inner = w.querySelector(".shuffle-inner") as HTMLElement;
        if (!inner) return;
        const at = i * stagger;
        if (isVertical) tl.fromTo(inner, { y: fromY }, { y: 0, duration, ease }, at);
        else tl.fromTo(inner, { x: fromX }, { x: 0, duration, ease }, at);
      });
    }
  }, [shuffleDirection, duration, ease, stagger, animationMode, respectReducedMotion]);

  const handleMouseEnter = useCallback(() => {
    if (!triggerOnHover) return;
    const el = ref.current;
    if (!el) return;
    // Reset letter positions so animation can replay
    const wrappers = el.querySelectorAll(".shuffle-char-wrapper .shuffle-inner");
    const fromX = shuffleDirection === "right" ? -20 : shuffleDirection === "left" ? 20 : 0;
    const fromY = shuffleDirection === "down" ? -20 : shuffleDirection === "up" ? 20 : 0;
    const isVertical = shuffleDirection === "up" || shuffleDirection === "down";
    wrappers.forEach((inner) => {
      gsap.set(inner, isVertical ? { y: fromY } : { x: fromX });
    });
    setReady(false);
    runAnimation();
  }, [triggerOnHover, runAnimation, shuffleDirection]);

  const chars = text.split("");
  const isVertical = shuffleDirection === "up" || shuffleDirection === "down";

  return (
    <Tag
      ref={ref}
      className={`shuffle-parent ${ready ? "is-ready" : ""} ${className}`}
      onMouseEnter={handleMouseEnter}
      style={{ display: "inline-block" }}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className="shuffle-char-wrapper"
          style={{
            display: "inline-block",
            overflow: "hidden",
            verticalAlign: "bottom",
          }}
        >
          <span className="shuffle-inner" style={{ display: "inline-block", willChange: "transform" }}>
            {c === " " ? "\u00A0" : c}
          </span>
        </span>
      ))}
    </Tag>
  );
}

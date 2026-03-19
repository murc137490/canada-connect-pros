import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: "chars" | "words" | "lines";
  from?: { opacity?: number; y?: number };
  to?: { opacity?: number; y?: number };
  threshold?: number;
  rootMargin?: string;
  textAlign?: "left" | "center" | "right";
  tag?: keyof JSX.IntrinsicElements;
  onLetterAnimationComplete?: () => void;
}

export default function SplitText({
  text,
  className = "",
  delay = 50,
  duration = 1.25,
  ease = "power3.out",
  splitType = "chars",
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = "-100px",
  textAlign = "center",
  tag: Tag = "p",
  onLetterAnimationComplete,
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [chars, setChars] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (splitType === "chars") {
      setChars(text.split(""));
    } else if (splitType === "words") {
      setWords(text.split(/\s+/));
    }
  }, [text, splitType]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text) return;
    if (doneRef.current) return;
    const count = splitType === "chars" ? chars.length : words.length;
    if (count === 0) return;

    const startPct = (1 - threshold) * 100;
    const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
    const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
    const marginUnit = marginMatch?.[2] || "px";
    const sign =
      marginValue === 0 ? "" : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`;
    const start = `top ${startPct}%${sign}`;

    const targets = splitType === "chars"
      ? el.querySelectorAll(".split-char")
      : el.querySelectorAll(".split-word");
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { ...from },
        {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
          },
          onComplete: () => {
            doneRef.current = true;
            onLetterAnimationComplete?.();
          },
        }
      );
    }, el);
    return () => ctx.revert();
  }, [text, splitType, chars.length, words.length, delay, duration, ease, threshold, rootMargin, JSON.stringify(from), JSON.stringify(to), onLetterAnimationComplete]);

  const style: React.CSSProperties = {
    textAlign,
    overflow: "hidden",
    display: "inline-block",
    whiteSpace: "normal",
    wordWrap: "break-word",
  };

  if (splitType === "chars" && chars.length > 0) {
    return (
      <Tag ref={ref as React.RefObject<HTMLParagraphElement>} style={style} className={`split-parent ${className}`}>
        {chars.map((c, i) => (
          <span key={i} className="split-char inline-block" style={{ willChange: "transform, opacity" }}>
            {c === " " ? "\u00A0" : c}
          </span>
        ))}
      </Tag>
    );
  }
  if (splitType === "words" && words.length > 0) {
    return (
      <Tag ref={ref as React.RefObject<HTMLParagraphElement>} style={style} className={`split-parent ${className}`}>
        {words.map((w, i) => (
          <span key={i} className="split-word inline-block" style={{ willChange: "transform, opacity" }}>
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </Tag>
    );
  }
  return (
    <Tag ref={ref as React.RefObject<HTMLParagraphElement>} style={style} className={`split-parent ${className}`}>
      {text}
    </Tag>
  );
}

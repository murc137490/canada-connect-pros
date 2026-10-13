import { useEffect, useMemo, useRef, type HTMLAttributes } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./ScrollFloat.css";

gsap.registerPlugin(ScrollTrigger);

interface ScrollFloatProps extends HTMLAttributes<HTMLSpanElement> {
  children: string;
  animationDuration?: number;
  stagger?: number;
}

export default function ScrollFloat({ children, className = "", animationDuration = 0.85, stagger = 0.025, ...props }: ScrollFloatProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const words = useMemo(() => children.split(/(\s+)/u), [children]);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = element.querySelectorAll<HTMLElement>(".scroll-float-char");
    const tween = gsap.fromTo(chars,
      { opacity: 0, yPercent: 80, scaleY: 1.45, transformOrigin: "50% 0%" },
      {
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        duration: animationDuration,
        ease: "back.out(1.4)",
        stagger,
        scrollTrigger: { trigger: element, start: "top 88%", end: "top 55%", scrub: 0.6 },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [animationDuration, children, stagger]);

  return (
    <span ref={ref} className={`scroll-float ${className}`} aria-label={children} {...props}>
      {words.map((word, wordIndex) => /^\s+$/u.test(word) ? (
        <span aria-hidden="true" key={`space-${wordIndex}`}>{word}</span>
      ) : (
        <span className="scroll-float-word" aria-hidden="true" key={`word-${wordIndex}`}>
          {Array.from(word).map((character, characterIndex) => (
            <span className="scroll-float-char" key={`${characterIndex}-${character}`}>
              {character}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

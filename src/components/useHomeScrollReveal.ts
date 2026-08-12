import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Fade/slide in `.home-chapter-reveal` elements as they enter the viewport. */
export function useHomeScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const elements = gsap.utils.toArray<HTMLElement>(".home-chapter-reveal");
    if (!elements.length) return;

    const ctx = gsap.context(() => {
      elements.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              once: true,
            },
          }
        );
      });
    });

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls refresh via deps
  }, deps);
}

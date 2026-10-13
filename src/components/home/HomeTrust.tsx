import { useLanguage } from "@/contexts/LanguageContext";
import ScrollReveal from "@/components/motion/ScrollReveal";
import ScrollFloat from "@/components/motion/ScrollFloat";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { useEffect, useRef, useState } from "react";

export default function HomeTrust() {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const items = [
    { title: t.index.trust1Title, desc: t.index.trust1Desc },
    { title: t.index.trust2Title, desc: t.index.trust2Desc },
    { title: t.index.trust3Title, desc: t.index.trust3Desc },
    { title: t.index.trust4Title, desc: t.index.trust4Desc },
  ];

  useEffect(() => {
    const element = benefitsRef.current;
    if (!element || reduced) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!hasEntered || reduced) return;
    let timeout: ReturnType<typeof setTimeout>;
    let count = 0;
    let stopped = false;
    const revealNext = () => {
      if (stopped) return;
      if (count < items.length) {
        count += 1;
        setVisibleCount(count);
        timeout = setTimeout(revealNext, 1250);
        return;
      }
      timeout = setTimeout(() => {
        setVisibleCount(0);
        count = 0;
        timeout = setTimeout(revealNext, 450);
      }, 2000);
    };
    revealNext();
    return () => {
      stopped = true;
      clearTimeout(timeout);
    };
  }, [hasEntered, items.length, reduced]);

  return (
    <section className="section-pad">
      <div className="container-page">
        <ScrollReveal>
          <div className="max-w-2xl md:max-w-none md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:items-start">
            <h2 className="font-display text-display-md text-foreground max-w-[12ch]">
              <ScrollFloat>{t.index.trustTitle}</ScrollFloat>
            </h2>
            {t.index.trustSupport ? (
              <p className="mt-4 md:mt-2 text-[17px] text-muted-foreground leading-relaxed max-w-md">
                {t.index.trustSupport}
              </p>
            ) : null}
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <ul
            ref={benefitsRef}
            className="mt-14 grid min-h-40 grid-cols-1 gap-6 border-y border-border/60 py-8 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border lg:py-10"
            aria-live="polite"
          >
            {items.map((item, index) => (
              <li
                key={item.title}
                className={`transition-[opacity,transform] duration-500 ease-out lg:px-7 first:lg:pl-0 last:lg:pr-0 ${reduced || visibleCount > index ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
                aria-hidden={!reduced && visibleCount <= index}
              >
                <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import ScrollReveal from "@/components/motion/ScrollReveal";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * "Trois étapes" — connector line + steps fill as you scroll.
 * Progress is written via rAF only while the section is near the viewport
 * (no Framer useScroll scrubbing).
 */
export default function HomeHowItWorks() {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(reduced ? 3 : 0);

  const steps = [
    { n: "01", title: t.index.step1, desc: t.index.step1Desc },
    { n: "02", title: t.index.step2, desc: t.index.step2Desc },
    { n: "03", title: t.index.step3, desc: t.index.step3Desc },
  ];

  useEffect(() => {
    if (reduced) {
      setActiveStep(3);
      const el = sectionRef.current;
      if (el) el.style.setProperty("--how-progress", "1");
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    let tracking = false;
    let lastStep = -1;

    const measure = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when section top is near bottom of viewport; 1 when well into view
      const start = vh * 0.88;
      const end = vh * 0.28;
      const raw = (start - rect.top) / Math.max(start - end, 1);
      const p = Math.min(1, Math.max(0, raw));
      section.style.setProperty("--how-progress", p.toFixed(3));

      const step =
        p < 0.12 ? 0 : p < 0.42 ? 1 : p < 0.72 ? 2 : 3;
      if (step !== lastStep) {
        lastStep = step;
        setActiveStep(step);
      }
    };

    const onScroll = () => {
      if (!tracking) return;
      if (!raf) raf = requestAnimationFrame(measure);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        tracking = !!entry?.isIntersecting;
        if (tracking) measure();
      },
      { rootMargin: "20% 0px 20% 0px", threshold: 0 }
    );

    io.observe(section);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    measure();

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="section-pad border-y border-border/70 bg-muted/35 dark:bg-muted/15"
      style={{ ["--how-progress" as string]: reduced ? 1 : 0 }}
    >
      <div className="container-page">
        <ScrollReveal y={28}>
          <h2 className="font-display text-display-md text-foreground whitespace-pre-line max-w-xl">
            {t.index.howTitle}
          </h2>
        </ScrollReveal>

        <ol className="relative mt-14 md:mt-20">
          {/* Desktop track */}
          <div
            className="pointer-events-none absolute left-[8%] right-[8%] top-[1.35rem] hidden h-[2px] overflow-hidden rounded-full bg-border md:block"
            aria-hidden
          >
            <div className="how-progress-fill h-full w-full origin-left rounded-full bg-primary" />
          </div>

          {/* Mobile vertical track */}
          <div
            className="pointer-events-none absolute left-[0.85rem] top-2 bottom-8 w-[2px] overflow-hidden rounded-full bg-border md:hidden"
            aria-hidden
          >
            <div className="how-progress-fill-y h-full w-full origin-top rounded-full bg-primary" />
          </div>

          <div className="grid gap-0 md:grid-cols-3 md:gap-10">
            {steps.map((step, i) => {
              const on = activeStep > i;
              return (
                <ScrollReveal key={step.n} y={26} delay={i * 0.06} amount={0.2}>
                  <li className="how-step relative flex gap-5 md:block md:gap-0">
                    <span
                      className={cn(
                        "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold tabular-nums transition-[border-color,color] duration-300 md:mb-6 md:h-auto md:w-auto md:border-0 md:bg-transparent md:text-left",
                        on ? "border-primary text-primary" : "border-border text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "md:font-display md:text-5xl lg:text-6xl md:leading-none transition-colors duration-300",
                          on ? "md:text-primary/70" : "md:text-primary/20"
                        )}
                      >
                        {step.n}
                      </span>
                    </span>

                    <div
                      className={cn(
                        "pb-10 md:pb-0 transition-opacity duration-300",
                        on ? "opacity-100" : "opacity-50"
                      )}
                    >
                      <h3 className="font-heading text-lg md:text-xl font-bold tracking-tight text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-xs text-[15px] text-muted-foreground leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                </ScrollReveal>
              );
            })}
          </div>
        </ol>
      </div>
    </section>
  );
}

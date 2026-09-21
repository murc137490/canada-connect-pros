import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * "Trois étapes" — opacity rises with scroll proximity (no pop-in).
 * Progress is written via rAF only while the section is near the viewport.
 */
export default function HomeHowItWorks() {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(reduced ? 3 : 1);

  const steps = [
    { n: "01", title: t.index.step1, desc: t.index.step1Desc },
    { n: "02", title: t.index.step2, desc: t.index.step2Desc },
    { n: "03", title: t.index.step3, desc: t.index.step3Desc },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (reduced) {
      setActiveStep(3);
      section.style.setProperty("--how-progress", "1");
      section.style.setProperty("--how-title-opacity", "1");
      section.style.setProperty("--how-step-0", "1");
      section.style.setProperty("--how-step-1", "1");
      section.style.setProperty("--how-step-2", "1");
      return;
    }

    let raf = 0;
    let tracking = false;
    let lastStep = -1;

    const opacityFor = (p: number, start: number, span: number, floor: number) => {
      const local = Math.min(1, Math.max(0, (p - start) / Math.max(span, 0.001)));
      return floor + local * (1 - floor);
    };

    const measure = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Peek in → fully opaque ~25% sooner than a mid-viewport gate.
      const start = vh * 0.98;
      const end = vh * 0.35;
      const raw = (start - rect.top) / Math.max(start - end, 1);
      const p = Math.min(1, Math.max(0, raw));
      section.style.setProperty("--how-progress", p.toFixed(3));
      // Title starts partly visible; steps stagger but stay readable while approaching.
      section.style.setProperty("--how-title-opacity", opacityFor(p, 0, 0.55, 0.28).toFixed(3));
      section.style.setProperty("--how-step-0", opacityFor(p, 0.0, 0.5, 0.22).toFixed(3));
      section.style.setProperty("--how-step-1", opacityFor(p, 0.12, 0.5, 0.18).toFixed(3));
      section.style.setProperty("--how-step-2", opacityFor(p, 0.24, 0.5, 0.15).toFixed(3));

      const step = p < 0.06 ? 1 : p < 0.34 ? 1 : p < 0.56 ? 2 : 3;
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
      { rootMargin: "40% 0px 40% 0px", threshold: 0 }
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
      style={
        {
          ["--how-progress" as string]: reduced ? 1 : 0,
          ["--how-title-opacity" as string]: reduced ? 1 : 0.28,
          ["--how-step-0" as string]: reduced ? 1 : 0.22,
          ["--how-step-1" as string]: reduced ? 1 : 0.18,
          ["--how-step-2" as string]: reduced ? 1 : 0.15,
        } as CSSProperties
      }
    >
      <div className="container-page">
        <h2
          className="how-scroll-fade font-display text-display-md text-foreground whitespace-pre-line max-w-xl"
          style={{ opacity: "var(--how-title-opacity)" }}
        >
          {t.index.howTitle}
        </h2>

        <ol className="relative mt-14 md:mt-20">
          <div
            className="pointer-events-none absolute left-[8%] right-[8%] top-[1.35rem] hidden h-[2px] overflow-hidden rounded-full bg-border md:block"
            aria-hidden
          >
            <div className="how-progress-fill h-full w-full origin-left rounded-full bg-primary" />
          </div>

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
                <li
                  key={step.n}
                  className="how-step how-scroll-fade relative flex gap-5 md:block md:gap-0"
                  style={{ opacity: `var(--how-step-${i})` }}
                >
                  <span
                    className={cn(
                      "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold tabular-nums transition-[border-color,color] duration-300 md:mb-6 md:h-auto md:w-auto md:border-0 md:bg-transparent md:text-left",
                      on ? "border-primary text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "md:font-display md:text-5xl lg:text-6xl md:leading-none transition-colors duration-300",
                        on ? "md:text-primary/70" : "md:text-primary/30"
                      )}
                    >
                      {step.n}
                    </span>
                  </span>

                  <div className="pb-10 md:pb-0">
                    <h3 className="font-heading text-lg md:text-xl font-bold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xs text-[15px] text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </div>
        </ol>
      </div>
    </section>
  );
}

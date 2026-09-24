import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Stickify-style progress from element top vs viewport.
 * Higher `startMul` / `fullMul` = reveals ~sooner (while still on the hero).
 */
function stickifyProgress(rectTop: number, vh: number, startMul: number, fullMul: number): number {
  const start = vh * startMul;
  const full = vh * fullMul;
  const raw = (start - rectTop) / Math.max(start - full, 1);
  const t = Math.min(1, Math.max(0, raw));
  return t * t * (3 - 2 * t);
}

/** Title + step 1: ~30% earlier so they read while the hero is still on screen. */
const EARLY = { start: 1.18, full: 0.62 } as const;
/** Steps 2–3: only clear once you scroll into the section. */
const LATE = [
  { start: 0.92, full: 0.4 },
  { start: 0.82, full: 0.34 },
] as const;

export default function HomeHowItWorks() {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(reduced ? 3 : 0);

  const steps = [
    { n: "01", title: t.index.step1, desc: t.index.step1Desc },
    { n: "02", title: t.index.step2, desc: t.index.step2Desc },
    { n: "03", title: t.index.step3, desc: t.index.step3Desc },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const applyFull = () => {
      setActiveStep(3);
      section.style.setProperty("--how-progress", "1");
      section.style.setProperty("--how-title-opacity", "1");
      section.style.setProperty("--how-title-blur", "0");
      section.style.setProperty("--how-title-y", "0");
      for (let i = 0; i < 3; i++) {
        section.style.setProperty(`--how-step-${i}`, "1");
        section.style.setProperty(`--how-step-${i}-blur`, "0");
        section.style.setProperty(`--how-step-${i}-y`, "0");
        section.style.setProperty(`--how-step-${i}-scale`, "1");
      }
    };

    if (reduced) {
      applyFull();
      return;
    }

    let raf = 0;
    let tracking = false;
    let lastStep = -1;

    const measure = () => {
      raf = 0;
      const vh = window.innerHeight || 1;

      const titleEl = titleRef.current;
      let titleP = 0;
      if (titleEl) {
        titleP = stickifyProgress(titleEl.getBoundingClientRect().top, vh, EARLY.start, EARLY.full);
        section.style.setProperty("--how-title-opacity", titleP.toFixed(3));
        section.style.setProperty("--how-title-blur", ((1 - titleP) * 14).toFixed(2));
        section.style.setProperty("--how-title-y", ((1 - titleP) * 36).toFixed(1));
      }

      let maxP = titleP;
      let onCount = 0;
      for (let i = 0; i < 3; i++) {
        const el = stepRefs.current[i];
        if (!el) continue;
        const curve = i === 0 ? EARLY : LATE[i - 1];
        const p = stickifyProgress(el.getBoundingClientRect().top, vh, curve.start, curve.full);
        maxP = Math.max(maxP, p);
        if (p > 0.5) onCount = i + 1;
        section.style.setProperty(`--how-step-${i}`, p.toFixed(3));
        section.style.setProperty(`--how-step-${i}-blur`, ((1 - p) * 10).toFixed(2));
        section.style.setProperty(`--how-step-${i}-y`, ((1 - p) * 28).toFixed(1));
        section.style.setProperty(`--how-step-${i}-scale`, (0.97 + p * 0.03).toFixed(3));
      }

      section.style.setProperty("--how-progress", maxP.toFixed(3));
      if (onCount !== lastStep) {
        lastStep = onCount;
        setActiveStep(Math.max(1, onCount));
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
      // Track early so hero-overlap still updates opacity
      { rootMargin: "80% 0px 40% 0px", threshold: 0 },
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
      className={cn(
        "border-y border-border/70 bg-muted/35 dark:bg-muted/15",
        // Overlap hero ~30% earlier so title + step 01 peek while hero is still on screen
        "-mt-10 pt-8 pb-14 sm:-mt-14 sm:pt-10 sm:pb-20 md:-mt-20 md:pt-12 md:pb-24 lg:-mt-24 lg:pt-14 lg:pb-28",
      )}
      style={
        {
          ["--how-progress" as string]: reduced ? 1 : 0,
          ["--how-title-opacity" as string]: reduced ? 1 : 0,
          ["--how-title-blur" as string]: reduced ? 0 : 14,
          ["--how-title-y" as string]: reduced ? 0 : 36,
          ["--how-step-0" as string]: reduced ? 1 : 0,
          ["--how-step-1" as string]: reduced ? 1 : 0,
          ["--how-step-2" as string]: reduced ? 1 : 0,
          ["--how-step-0-blur" as string]: reduced ? 0 : 10,
          ["--how-step-1-blur" as string]: reduced ? 0 : 10,
          ["--how-step-2-blur" as string]: reduced ? 0 : 10,
          ["--how-step-0-y" as string]: reduced ? 0 : 28,
          ["--how-step-1-y" as string]: reduced ? 0 : 28,
          ["--how-step-2-y" as string]: reduced ? 0 : 28,
          ["--how-step-0-scale" as string]: reduced ? 1 : 0.97,
          ["--how-step-1-scale" as string]: reduced ? 1 : 0.97,
          ["--how-step-2-scale" as string]: reduced ? 1 : 0.97,
        } as CSSProperties
      }
    >
      <div className="container-page">
        <h2
          ref={titleRef}
          className="how-scroll-fade font-display text-display-md text-foreground whitespace-pre-line max-w-xl"
          style={{
            opacity: "var(--how-title-opacity)",
            filter: "blur(calc(var(--how-title-blur) * 1px))",
            transform: "translate3d(0, calc(var(--how-title-y) * 1px), 0)",
          }}
        >
          {t.index.howTitle}
        </h2>

        <ol className="relative mt-10 md:mt-14">
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
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="how-step how-scroll-fade relative flex gap-5 md:block md:gap-0"
                  style={{
                    opacity: `var(--how-step-${i})`,
                    filter: `blur(calc(var(--how-step-${i}-blur) * 1px))`,
                    transform: `translate3d(0, calc(var(--how-step-${i}-y) * 1px), 0) scale(var(--how-step-${i}-scale))`,
                  }}
                >
                  <span
                    className={cn(
                      "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold tabular-nums transition-[border-color,color] duration-300 md:mb-6 md:h-auto md:w-auto md:border-0 md:bg-transparent md:text-left",
                      on ? "border-primary text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "md:font-display md:text-5xl lg:text-6xl md:leading-none transition-colors duration-300",
                        on ? "md:text-primary/70" : "md:text-primary/30",
                      )}
                    >
                      {step.n}
                    </span>
                  </span>

                  <div className="pb-10 md:pb-0">
                    <h3 className="font-heading text-lg md:text-xl font-bold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xs text-[15px] text-muted-foreground leading-relaxed">{step.desc}</p>
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

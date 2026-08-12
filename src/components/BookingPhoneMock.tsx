import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const STEP_MS = 3400;

type Props = {
  className?: string;
  /** Hero: animate immediately without waiting for scroll. */
  alwaysLive?: boolean;
};

/** Wobbling phone mock — rotating role-based perks (pros / clients / users). */
export default function BookingPhoneMock({ className, alwaysLive = false }: Props) {
  const { t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const appearRef = useRef<HTMLDivElement>(null);
  const jelloRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(alwaysLive);

  const reviews = [
    {
      role: t.index.review1Name,
      body: t.index.review1Body,
      tag: t.index.review1Tag,
    },
    {
      role: t.index.review2Name,
      body: t.index.review2Body,
      tag: t.index.review2Tag,
    },
    {
      role: t.index.review3Name,
      body: t.index.review3Body,
      tag: t.index.review3Tag,
    },
  ] as const;

  useEffect(() => {
    if (alwaysLive) {
      setLive(true);
      return;
    }
    const root = rootRef.current;
    const appear = appearRef.current;
    if (!root || !appear) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        appear,
        { opacity: 0, scale: 0.94 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root,
            start: "top 85%",
            once: true,
            onEnter: () => setLive(true),
          },
        }
      );
    }, root);

    return () => ctx.revert();
  }, [alwaysLive]);

  useEffect(() => {
    const jello = jelloRef.current;
    if (!jello) return;

    // Skip spring loop when user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastY = window.scrollY;
    let lastT = performance.now();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let looping = false;

    let y = 0;
    let vy = 0;
    let targetY = 0;

    const stiffness = 0.14;
    const damping = 0.76;
    const maxY = 24;

    const stopLoop = () => {
      looping = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      y = 0;
      vy = 0;
      targetY = 0;
      jello.style.transform = "";
    };

    const tick = () => {
      const ay = (targetY - y) * stiffness;
      vy = (vy + ay) * damping;
      y += vy;

      const settled =
        Math.abs(targetY) < 0.01 && Math.abs(y) < 0.04 && Math.abs(vy) < 0.04;

      if (settled) {
        stopLoop();
        return;
      }

      jello.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (looping) return;
      looping = true;
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const now = performance.now();
      const dy = window.scrollY - lastY;
      const dt = Math.max(now - lastT, 8);
      lastY = window.scrollY;
      lastT = now;

      // Ignore tiny scroll jitter
      if (Math.abs(dy) < 0.5) return;

      const vel = dy / dt;
      targetY = Math.max(-maxY, Math.min(maxY, -vel * 12));
      ensureLoop();

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        targetY = 0;
        ensureLoop();
      }, 80);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stopLoop();
      window.removeEventListener("scroll", onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % reviews.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [live, reviews.length]);

  return (
    <div ref={rootRef} className={cn("flex justify-center", className)}>
      <div
        ref={appearRef}
        className="relative w-[220px] sm:w-[248px]"
        style={{
          transformOrigin: "center center",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          opacity: alwaysLive ? 1 : undefined,
        }}
      >
        <div
          ref={jelloRef}
          className="will-change-transform"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {/* Outer metallic rim → black chassis → glass screen (reads as a real phone in both themes) */}
          <div
            className={cn(
              "relative isolate rounded-[2.15rem] p-[1.5px]",
              "bg-gradient-to-b from-zinc-300 via-zinc-500 to-zinc-800",
              "dark:from-zinc-400 dark:via-zinc-600 dark:to-zinc-950",
              "shadow-[0_28px_50px_-18px_rgba(0,0,0,0.55)]",
              "dark:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.85)]"
            )}
          >
            <div className="relative overflow-hidden rounded-[2.05rem] bg-[#0a0a0a] p-[8px] dark:bg-black">
              {/* Side buttons */}
              <span
                aria-hidden
                className="pointer-events-none absolute -left-[2px] top-[88px] h-8 w-[2px] rounded-l-sm bg-gradient-to-b from-zinc-400 to-zinc-600 dark:from-zinc-500 dark:to-zinc-700"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -left-[2px] top-[128px] h-12 w-[2px] rounded-l-sm bg-gradient-to-b from-zinc-400 to-zinc-600 dark:from-zinc-500 dark:to-zinc-700"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-[2px] top-[118px] h-16 w-[2px] rounded-r-sm bg-gradient-to-b from-zinc-400 to-zinc-600 dark:from-zinc-500 dark:to-zinc-700"
              />

              <div
                className={cn(
                  "relative aspect-[9/19] overflow-hidden rounded-[1.55rem]",
                  "bg-[#f4f6f9] dark:bg-[#121417]"
                )}
                style={{ transform: "translateZ(0)" }}
              >
                {/* Dynamic Island */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-black shadow-inner"
                />

                <div className="absolute inset-0 pt-7">
                  {reviews.map((review, i) => (
                    <PhoneScreen key={review.role} active={step === i}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(217_75%_42%)] dark:text-sky-300/85">
                        {t.index.reviewPhoneEyebrow}
                      </p>
                      <h4 className="mt-1.5 font-heading text-[15px] font-extrabold leading-tight tracking-tight text-[#141414] dark:text-zinc-50">
                        {t.index.reviewPhoneTitle}
                      </h4>

                      <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#1c1f24] dark:shadow-none">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[hsl(222_76%_28%)] dark:text-sky-200/95">
                          {review.role}
                        </p>
                        <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#1f2937] dark:text-zinc-300">
                          {review.body}
                        </p>
                        <p className="mt-auto pt-4 inline-flex self-start rounded-md bg-[hsl(217_75%_45%/0.1)] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[hsl(222_76%_28%)] dark:bg-sky-400/12 dark:text-sky-100/90">
                          {review.tag}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-center gap-1.5">
                        {reviews.map((_, di) => (
                          <span
                            key={di}
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-500",
                              di === step
                                ? "w-5 bg-[hsl(222_76%_24%)] dark:bg-zinc-200"
                                : "w-1.5 bg-[#d1d5db] dark:bg-zinc-600"
                            )}
                          />
                        ))}
                      </div>

                      {/* Home indicator */}
                      <div
                        aria-hidden
                        className="mx-auto mt-3 h-1 w-20 rounded-full bg-black/20 dark:bg-white/25"
                      />
                    </PhoneScreen>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneScreen({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col p-4 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        active
          ? "z-10 scale-100 opacity-100"
          : "pointer-events-none z-0 scale-[0.992] opacity-0"
      )}
    >
      {children}
    </div>
  );
}

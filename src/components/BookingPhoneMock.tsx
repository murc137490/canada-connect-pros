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
            start: "top 82%",
            end: "bottom 18%",
            toggleActions: "play reverse play reverse",
            onToggle: (self) => setLive(self.isActive),
          },
        }
      );
    }, root);

    return () => ctx.revert();
  }, [alwaysLive]);

  useEffect(() => {
    const jello = jelloRef.current;
    if (!jello) return;

    let lastY = window.scrollY;
    let lastT = performance.now();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    let y = 0;
    let vy = 0;
    let targetY = 0;
    let running = true;

    const stiffness = 0.14;
    const damping = 0.76;
    const maxY = 32;

    const tick = () => {
      if (!running) return;
      const ay = (targetY - y) * stiffness;
      vy = (vy + ay) * damping;
      y += vy;

      if (Math.abs(targetY) < 0.01 && Math.abs(y) < 0.04 && Math.abs(vy) < 0.04) {
        y = 0;
        vy = 0;
      }

      jello.style.transform = `translate3d(0, ${y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      const now = performance.now();
      const dy = window.scrollY - lastY;
      const dt = Math.max(now - lastT, 8);
      lastY = window.scrollY;
      lastT = now;

      const vel = dy / dt;
      targetY = Math.max(-maxY, Math.min(maxY, -vel * 14));

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        targetY = 0;
      }, 60);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
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
          <div
            className={cn(
              "relative overflow-hidden rounded-[2rem] p-[9px] isolate",
              // Chassis + rim: light mode stays near-black; dark mode uses a mid bezel
              // and a soft white outline so the phone doesn’t disappear on dark pages.
              "bg-zinc-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/25",
              "dark:bg-zinc-600 dark:ring-white/35",
              "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_28px_-6px_rgba(255,255,255,0.18),0_24px_60px_-20px_rgba(0,0,0,0.65)]"
            )}
          >
            <div
              className={cn(
                "relative aspect-[9/19] overflow-hidden rounded-[1.5rem]",
                "bg-[#f4f6f9] dark:bg-zinc-900/95",
                "ring-1 ring-inset ring-black/5 dark:ring-white/15"
              )}
              style={{ transform: "translateZ(0)" }}
            >
              <div className="absolute inset-0">
                {reviews.map((review, i) => (
                  <PhoneScreen key={review.role} active={step === i}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(217_75%_42%)] dark:text-sky-300/90">
                      {t.index.reviewPhoneEyebrow}
                    </p>
                    <h4 className="mt-1.5 font-heading text-[15px] font-extrabold leading-tight tracking-tight text-[#141414] dark:text-zinc-50">
                      {t.index.reviewPhoneTitle}
                    </h4>

                    <div className="mt-5 flex flex-1 flex-col rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm dark:border-white/12 dark:bg-zinc-800/90 dark:shadow-none">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[hsl(222_76%_28%)] dark:text-sky-200">
                        {review.role}
                      </p>
                      <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#1f2937] dark:text-zinc-200">
                        {review.body}
                      </p>
                      <p className="mt-auto pt-4 inline-flex self-start rounded-md bg-[hsl(217_75%_45%/0.1)] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[hsl(222_76%_28%)] dark:bg-sky-400/15 dark:text-sky-100">
                        {review.tag}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-1.5">
                      {reviews.map((_, di) => (
                        <span
                          key={di}
                          className={cn(
                            "h-1.5 rounded-full transition-all duration-500",
                            di === step
                              ? "w-5 bg-[hsl(222_76%_24%)] dark:bg-zinc-100"
                              : "w-1.5 bg-[#d1d5db] dark:bg-zinc-600"
                          )}
                        />
                      ))}
                    </div>
                  </PhoneScreen>
                ))}
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, Star, MapPin, Check, ChevronRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const STEP_MS = 3200;

/** Phone mock: search → pro → price, with scroll-velocity jello bounce. */
export default function BookingPhoneMock({ className }: { className?: string }) {
  const { t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const appearRef = useRef<HTMLDivElement>(null);
  const jelloRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);

  // Appear / disappear with scroll (same ease both ways)
  useEffect(() => {
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
  }, []);

  // Scroll-velocity jello on inner layer only (Y only, no rotate = no white fringe)
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
      setStep((s) => (s + 1) % 3);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [live]);

  return (
    <div ref={rootRef} className={cn("flex justify-center", className)}>
      <div
        ref={appearRef}
        className="relative w-[220px] sm:w-[240px]"
        style={{
          transformOrigin: "center center",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div
          ref={jelloRef}
          className="will-change-transform"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {/* Solid bezel plate: no CSS border (borders fringe when transformed) */}
          <div
            className="relative overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
            style={{
              background: "#111111",
              padding: 9,
              isolation: "isolate",
            }}
          >
            <div
              className="relative aspect-[9/19] overflow-hidden rounded-[1.5rem]"
              style={{ background: "#f7f9fc", transform: "translateZ(0)" }}
            >
              <div className="absolute inset-0">
                <PhoneScreen active={step === 0}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(217_75%_42%)]">
                    Premiere
                  </p>
                  <h4 className="mt-1.5 font-heading text-[15px] font-extrabold leading-tight tracking-tight text-[#141414]">
                    {t.index.phoneSearchTitle}
                  </h4>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-2.5 py-2.5 shadow-sm">
                    <Search size={12} className="shrink-0 text-[hsl(217_75%_45%)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-[#141414]">{t.index.phoneSearchQuery}</p>
                      <p className="text-[9px] text-[#6b7280]">{t.index.phoneSearchPostal}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[t.index.phoneSearchHint1, t.index.phoneSearchHint2].map((hint) => (
                      <div
                        key={hint}
                        className="rounded-lg bg-[hsl(217_75%_45%/0.08)] px-2.5 py-1.5 text-[10px] font-medium text-[#1f2937]"
                      >
                        {hint}
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between rounded-xl bg-[hsl(222_76%_24%)] px-3 py-2.5 text-white">
                    <span className="text-[10px] font-semibold">{t.index.phoneSearchCta}</span>
                    <ChevronRight size={12} />
                  </div>
                </PhoneScreen>

                <PhoneScreen active={step === 1}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(217_75%_42%)]">
                    {t.index.phoneProEyebrow}
                  </p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(35_92%_60%/0.25)] text-sm font-bold text-[hsl(222_76%_24%)]">
                      MJ
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#141414]">{t.index.phoneProName}</p>
                      <p className="flex items-center gap-1 text-[10px] text-[#6b7280]">
                        <Star size={10} className="fill-[hsl(35_92%_55%)] text-[hsl(35_92%_55%)]" />
                        4.9 · {t.index.phoneProJobs}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-[10px] text-[#6b7280]">
                    <MapPin size={10} />
                    {t.index.phoneProArea}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {[t.index.phoneProTag1, t.index.phoneProTag2].map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5 text-[10px] text-[#141414]"
                      >
                        <Check size={10} className="text-[hsl(160_50%_35%)]" />
                        {tag}
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto rounded-xl bg-[hsl(217_75%_45%)] px-3 py-2.5 text-center text-[10px] font-semibold text-white">
                    {t.index.phoneProCta}
                  </div>
                </PhoneScreen>

                <PhoneScreen active={step === 2}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(217_75%_42%)]">
                    {t.index.phonePriceEyebrow}
                  </p>
                  <h4 className="mt-1.5 font-heading text-[14px] font-extrabold leading-tight text-[#141414]">
                    {t.index.phonePriceTitle}
                  </h4>
                  <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-3.5 shadow-sm">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-[#6b7280]">
                      {t.index.phonePriceEstimate}
                    </p>
                    <p className="mt-0.5 font-heading text-[28px] font-extrabold tracking-tight text-[hsl(222_76%_24%)]">
                      {t.index.phonePriceAmount}
                    </p>
                    <p className="text-[10px] text-[#6b7280]">{t.index.phonePriceNote}</p>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#6b7280]">{t.index.phonePriceLine1}</span>
                      <span className="font-semibold text-[#141414]">$85</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#6b7280]">{t.index.phonePriceLine2}</span>
                      <span className="font-semibold text-[#141414]">$20</span>
                    </div>
                  </div>
                  <div className="mt-auto rounded-xl bg-[hsl(35_92%_55%)] px-3 py-2.5 text-center text-[10px] font-bold text-[hsl(222_47%_11%)]">
                    {t.index.phonePriceCta}
                  </div>
                </PhoneScreen>
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

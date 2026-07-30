import { useEffect, useRef } from "react";
import { Search, Users, CheckCircle } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import HomeChapter from "@/components/HomeChapter";
import BookingPhoneMock from "@/components/BookingPhoneMock";

gsap.registerPlugin(ScrollTrigger);

const stepKeys = ["step1", "step2", "step3"] as const;
const stepDescKeys = ["step1Desc", "step2Desc", "step3Desc"] as const;
const stepIcons = [Search, Users, CheckCircle];

export default function HowItWorks() {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const steps = track.querySelectorAll<HTMLElement>(".how-step");
    if (!steps.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        steps,
        { opacity: 0.35, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: track,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );

      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 70%",
          onEnter: () => {
            steps.forEach((s, j) => s.classList.toggle("how-step-active", j === i));
          },
        });
      });
    }, track);

    return () => ctx.revert();
  }, []);

  return (
    <HomeChapter
      id="how-it-works"
      eyebrow={t.index.chapterBookEyebrow}
      title={t.index.chapterBookTitle}
      support={t.index.chapterBookSupport}
      tone="muted"
    >
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div ref={trackRef} className="grid gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-1 lg:gap-4">
          {stepKeys.map((key, i) => {
            const Icon = stepIcons[i];
            return (
              <div
                key={key}
                className="how-step relative rounded-3xl border border-border/80 bg-card p-5 text-left shadow-sm transition-all duration-300 md:p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <Icon size={20} className="text-primary" />
                  </div>
                </div>
                <h3 className="font-heading text-base font-bold leading-snug text-foreground md:text-lg">
                  {t.index[key]}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t.index[stepDescKeys[i]]}
                </p>
              </div>
            );
          })}
        </div>

        <BookingPhoneMock />
      </div>
    </HomeChapter>
  );
}

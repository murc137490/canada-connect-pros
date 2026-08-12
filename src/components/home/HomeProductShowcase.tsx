import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import MarketplacePreview from "@/components/home/MarketplacePreview";
import { useInViewToggle } from "@/hooks/useInViewToggle";
import { cn } from "@/lib/utils";

/** Soft reverse fade — IntersectionObserver + CSS only (no scroll scrubbing). */
export default function HomeProductShowcase() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const visible = useInViewToggle(sectionRef, {
    enterAt: 0.18,
    leaveAt: 0.05,
    rootMargin: "0px 0px -18% 0px",
  });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>(".home-soft-appear");
    nodes.forEach((node) => {
      node.classList.add("home-soft-appear--busy");
      const done = () => node.classList.remove("home-soft-appear--busy");
      node.addEventListener("transitionend", done, { once: true });
      window.setTimeout(done, 700);
    });
  }, [visible]);

  const journey = [
    t.index.journey1,
    t.index.journey2,
    t.index.journey3,
    t.index.journey4,
  ];

  return (
    <section
      ref={sectionRef}
      className="section-pad bg-primary text-primary-foreground overflow-hidden"
    >
      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 xl:gap-20">
          <div className={cn("home-soft-appear", visible && "home-soft-appear--in")}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              {t.index.showcaseEyebrow}
            </p>
            <h2 className="mt-4 font-display text-display-md tracking-tight text-white whitespace-pre-line">
              {t.index.showcaseTitle}
            </h2>
            <p className="mt-4 max-w-sm text-[15px] text-white/65 leading-relaxed">
              {t.index.showcaseSupport}
            </p>

            <ol className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-white/75">
              {journey.map((label, i) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <span className="font-semibold text-white/40 tabular-nums">{i + 1}.</span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>

            <Button
              size="lg"
              className="group mt-8 h-11 gap-2 bg-white text-primary hover:bg-white/92 px-6"
              asChild
            >
              <Link to="/make-request">
                {t.index.ctaPublish}
                <ArrowRight className="cta-arrow h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div
            className={cn(
              "home-soft-appear home-soft-appear--delay",
              visible && "home-soft-appear--in"
            )}
          >
            <MarketplacePreview variant="dark" matchState="matched" />
          </div>
        </div>
      </div>
    </section>
  );
}

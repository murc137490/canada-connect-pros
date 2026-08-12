import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import MarketplacePreview from "@/components/home/MarketplacePreview";
import ScrollReveal from "@/components/motion/ScrollReveal";

export default function HomeProductShowcase() {
  const { t } = useLanguage();
  const journey = [
    t.index.journey1,
    t.index.journey2,
    t.index.journey3,
    t.index.journey4,
  ];

  return (
    <section className="section-pad bg-primary text-primary-foreground overflow-hidden">
      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 xl:gap-20">
          {/* once + 70% viewport line: avoid blank-blue flash / edge flicker between sections */}
          <ScrollReveal once y={6} amount={0.25} margin="0px 0px -30% 0px">
            <div>
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
          </ScrollReveal>

          <ScrollReveal once delay={0.08} y={6} amount={0.25} margin="0px 0px -30% 0px">
            <MarketplacePreview variant="dark" matchState="matched" />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

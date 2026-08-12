import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export default function HomeProCta() {
  const { t } = useLanguage();
  const benefits = [
    t.index.proBenefit1,
    t.index.proBenefit2,
    t.index.proBenefit3,
    t.index.proBenefit4,
    t.index.proBenefit5,
  ];

  return (
    <section className="section-pad border-t border-border/60 bg-muted/30 dark:bg-muted/15">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <h2 className="font-display text-display-md text-foreground tracking-tight whitespace-pre-line">
              {t.index.proSectionTitle}
            </h2>
            <p className="mt-4 max-w-lg text-base md:text-lg text-muted-foreground leading-relaxed">
              {t.index.proSectionSupport}
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 gap-2 rounded-full px-7 group"
              asChild
            >
              <Link to="/join-pros">
                {t.index.ctaBecomePro}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {benefits.map((b) => (
              <li
                key={b}
                className="flex items-center gap-3 text-sm md:text-base text-foreground/90"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

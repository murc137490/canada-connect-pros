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
  ];

  return (
    <section className="section-pad border-t border-border">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-20">
          <div>
            <h2 className="font-display text-display-md text-foreground whitespace-pre-line max-w-[14ch]">
              {t.index.proSectionTitle}
            </h2>
            <p className="mt-5 max-w-md text-[17px] text-muted-foreground leading-relaxed">
              {t.index.proSectionSupport}
            </p>
            <Button size="lg" className="group mt-8 h-11 gap-2 px-6" asChild>
              <Link to="/join-pros">
                {t.index.ctaBecomePro}
                <ArrowRight className="cta-arrow h-4 w-4" />
              </Link>
            </Button>
          </div>

          <ul className="space-y-0 border-t border-border">
            {benefits.map((b) => (
              <li
                key={b}
                className="border-b border-border py-4 text-[15px] font-medium text-foreground/90"
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

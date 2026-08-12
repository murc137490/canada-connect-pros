import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import MarketplacePreview from "@/components/home/MarketplacePreview";

export default function HomeProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="section-pad bg-primary text-primary-foreground">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <h2 className="font-display text-display-md tracking-tight text-white whitespace-pre-line">
              {t.index.showcaseTitle}
            </h2>
            <p className="mt-4 max-w-md text-base md:text-lg text-white/70 leading-relaxed">
              {t.index.showcaseSupport}
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 gap-2 rounded-full bg-white text-primary hover:bg-white/90 px-7 group"
              asChild
            >
              <Link to="/make-request">
                {t.index.ctaPublish}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <MarketplacePreview variant="dark" className="lg:justify-self-end" />
        </div>
      </div>
    </section>
  );
}

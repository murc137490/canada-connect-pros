import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import MarketplacePreview from "@/components/home/MarketplacePreview";
import ScrollReveal from "@/components/motion/ScrollReveal";
import ScrollFloat from "@/components/motion/ScrollFloat";

/** Blue product story stays visible after it enters the viewport. */
export default function HomeProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="section-pad bg-primary text-primary-foreground overflow-hidden">
      <div className="container-page">
        <ScrollReveal className="w-full" once amount={0.1} margin="0px 0px 0px 0px">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 xl:gap-16">
            <div>
              <h2 className="mt-4 font-display text-display-md tracking-tight text-white whitespace-pre-line">
                <ScrollFloat>{t.index.showcaseTitle}</ScrollFloat>
              </h2>

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

            <div className="w-full min-w-0">
              <MarketplacePreview variant="dark" matchState="idle" />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

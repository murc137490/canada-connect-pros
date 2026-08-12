import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import HomeCategories from "@/components/home/HomeCategories";
import HomeHowItWorks from "@/components/home/HomeHowItWorks";
import HomeProductShowcase from "@/components/home/HomeProductShowcase";
import HomeTrust from "@/components/home/HomeTrust";
import HomeProCta from "@/components/home/HomeProCta";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { shouldShowJoinPros, useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeVerifiedPro, ready: activeVerifiedProReady } = useActiveVerifiedPro(user?.id);
  const showBecomeProCta = shouldShowJoinPros(user?.id, activeVerifiedPro, activeVerifiedProReady);

  return (
    <Layout>
      <HeroSection />
      <HomeCategories />
      <HomeHowItWorks />
      <HomeProductShowcase />
      <HomeTrust />
      {showBecomeProCta && <HomeProCta />}

      <section className="section-pad border-t border-border/60">
        <div className="container-page text-center">
          <h2 className="font-display text-display-md text-foreground tracking-tight">
            {t.index.closingTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base md:text-lg text-muted-foreground leading-relaxed">
            {t.index.closingSupport}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="group h-12 px-7 gap-2" asChild>
              <Link to="/make-request">
                {t.index.ctaPublish}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            {showBecomeProCta && (
              <Button size="lg" variant="outline" className="h-12 px-7" asChild>
                <Link to="/join-pros">{t.index.closingBecomePro}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;

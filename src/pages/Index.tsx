import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import HomeChapter from "@/components/HomeChapter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { shouldShowJoinPros, useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";
import { useHomeScrollReveal } from "@/components/useHomeScrollReveal";
import ServiceMixPie from "@/components/ServiceMixPie";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeVerifiedPro, ready: activeVerifiedProReady } = useActiveVerifiedPro(user?.id);
  const showBecomeProCta = shouldShowJoinPros(user?.id, activeVerifiedPro, activeVerifiedProReady);

  useHomeScrollReveal([showBecomeProCta]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".scroll-fade-in").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToHeroSearch = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <HeroSection />
      <HowItWorks />

      <HomeChapter
        eyebrow={t.index.chapterRatesEyebrow}
        title={t.index.chapterRatesTitle}
        support={t.index.chapterRatesSupport}
        tone="default"
        cta={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              asChild
            >
              <Link to="/services">
                {t.index.chapterRatesCta} <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary/20 bg-background/80"
              type="button"
              onClick={scrollToHeroSearch}
            >
              {t.index.closingFindPro}
            </Button>
          </div>
        }
      >
        <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {(
              [
                [t.index.chapterRatesPoint1Title, t.index.chapterRatesPoint1Desc],
                [t.index.chapterRatesPoint2Title, t.index.chapterRatesPoint2Desc],
                [t.index.chapterRatesPoint3Title, t.index.chapterRatesPoint3Desc],
              ] as const
            ).map(([title, desc], i) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-muted/30 px-5 py-6 text-left dark:bg-muted/15"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">0{i + 1}</p>
                <p className="mt-2 font-heading text-base font-bold text-foreground md:text-lg">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <ServiceMixPie className="rounded-3xl border border-border bg-card p-5 md:p-7" />
        </div>
      </HomeChapter>

      <HomeChapter
        eyebrow={t.index.chapterCommunityEyebrow}
        title={t.index.chapterCommunityTitle}
        support={t.index.chapterCommunitySupport}
        tone="warm"
      />

      {showBecomeProCta && (
        <HomeChapter
          eyebrow={t.index.chapterProEyebrow}
          title={t.index.chapterProTitle}
          support={t.index.chapterProSupport}
          tone="primary"
          cta={
            <Button
              size="lg"
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              asChild
            >
              <Link to="/join-pros">
                {t.index.chapterProCta} <ArrowRight size={18} />
              </Link>
            </Button>
          }
        />
      )}

      <HomeChapter
        title={t.index.closingTitle}
        support={t.index.closingSupport}
        tone="muted"
        compact
        cta={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              type="button"
              onClick={scrollToHeroSearch}
            >
              {t.index.closingFindPro} <ArrowRight size={18} />
            </Button>
            {showBecomeProCta && (
              <Button size="lg" variant="outline" asChild>
                <Link to="/join-pros">{t.index.closingBecomePro}</Link>
              </Button>
            )}
          </div>
        }
      />
    </Layout>
  );
};

export default Index;

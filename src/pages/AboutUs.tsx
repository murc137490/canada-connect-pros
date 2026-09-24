import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import GradientText from "@/components/GradientText";
import { Button } from "@/components/ui/button";
import { Handshake, Home, Sparkles } from "lucide-react";

export default function AboutUs() {
  const { t } = useLanguage();
  const a = t.about;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <section className="relative overflow-hidden border-b border-border/40">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 0%, hsl(160 45% 42% / 0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, hsl(210 40% 45% / 0.12), transparent 50%)",
            }}
          />
          <div className="container relative px-4 md:px-6 pt-16 md:pt-24 pb-14 md:pb-20 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
              {a.eyebrow}
            </p>
            <GradientText colors={["#007A56", "#2C698C", "#1a1a1a"]} animationSpeed={12} className="inline-block">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-left">
                {a.title}
              </h1>
            </GradientText>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {a.lead}
            </p>
          </div>
        </section>

        <div className="container px-4 md:px-6 py-12 md:py-16 max-w-3xl space-y-14 md:space-y-16">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Home className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.granbyTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.granbyBody}</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.whoTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.whoBody}</p>
            <ul className="mt-4 space-y-3 text-base text-foreground/90 leading-relaxed">
              <li className="pl-4 border-l-2 border-emerald-600/50">{a.whoSmallBiz}</li>
              <li className="pl-4 border-l-2 border-emerald-600/50">{a.whoRetired}</li>
              <li className="pl-4 border-l-2 border-emerald-600/50">{a.whoAnyone}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Handshake className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.exchangeTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.exchangeBody}</p>
          </section>

          <section className="pt-2 pb-8 md:pb-12">
            <p className="text-base md:text-lg text-foreground leading-relaxed mb-6">{a.ctaLead}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/join-pros">{a.ctaPro}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/make-request">{a.ctaClient}</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Users, Star, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import GradientText from "@/components/GradientText";
import ShinyText from "@/components/ShinyText";
import Noise from "@/components/Noise";
import CardNav from "@/components/CardNav";
import type { CardNavItem } from "@/components/CardNav";
import ProPlansContent from "@/components/ProPlansContent";
import MovingStarsBackground from "@/components/MovingStarsBackground";

export default function JoinPros() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();

  const benefits = [
    { icon: TrendingUp, title: t.joinPros.growTitle, description: t.joinPros.growDesc },
    { icon: Users, title: t.joinPros.reachTitle, description: t.joinPros.reachDesc },
    { icon: Star, title: t.joinPros.buildTitle, description: t.joinPros.buildDesc },
    { icon: Shield, title: t.joinPros.secureTitle, description: t.joinPros.secureDesc },
  ];

  const cardNavItems: CardNavItem[] = [
    { label: t.joinPros.growTitle, bgColor: "hsl(var(--primary) / 0.15)", textColor: "hsl(var(--foreground))", description: t.joinPros.growDesc },
    { label: t.joinPros.reachTitle, bgColor: "hsl(var(--primary) / 0.12)", textColor: "hsl(var(--foreground))", description: t.joinPros.reachDesc },
    { label: t.joinPros.buildTitle, bgColor: "hsl(var(--primary) / 0.1)", textColor: "hsl(var(--foreground))", description: t.joinPros.buildDesc },
    { label: t.joinPros.secureTitle, bgColor: "hsl(var(--primary) / 0.08)", textColor: "hsl(var(--foreground))", description: t.joinPros.secureDesc },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
      <div className="bg-primary text-primary-foreground">
        <div className="container py-10 md:py-16 px-4 md:px-6 text-center">
          <GradientText
            colors={["#fff", "hsl(var(--secondary))", "#EABB1F", "#fff"]}
            animationSpeed={6}
            showBorder={false}
            className="font-heading text-3xl md:text-5xl font-extrabold mb-3 md:mb-4"
          >
            {t.joinPros.title}
          </GradientText>
          <p className="text-primary-foreground/70 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {t.joinPros.subtitle}
          </p>
        </div>
      </div>

      {!user && (
      <section className="py-10 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="relative bg-card border rounded-2xl p-5 md:p-6 card-hover space-y-3 overflow-hidden">
                <Noise patternAlpha={12} patternRefreshInterval={3} className="rounded-2xl" />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <b.icon size={24} className="text-secondary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mt-3">
                    <ShinyText
                      text={b.title}
                      speed={2.5}
                      color="hsl(var(--foreground))"
                      shineColor={resolvedTheme === "dark" ? "#000" : "#fff"}
                      spread={100}
                      className="font-heading font-bold"
                    />
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {user ? (
        <section className="relative min-h-screen pb-16 md:pb-24 px-4 md:px-6 overflow-visible">
          <MovingStarsBackground
            starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
            className={cn(
              "absolute inset-0 rounded-none min-h-full",
              resolvedTheme === "dark"
                ? "bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]"
                : "bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]"
            )}
            pointerEvents={false}
          />
          <div className="relative z-10 pt-10 md:pt-16 pb-8">
            <div className="container max-w-3xl mb-8">
              <CardNav
                logoText="Premiere Services"
                items={cardNavItems}
                ctaLabel={t.joinPros.completeProfile}
                ctaHref="/create-pro-account"
                baseColor="transparent"
              />
            </div>
            <div className="container">
              <ProPlansContent />
            </div>
          </div>
        </section>
      ) : (
        <section className="py-10 md:py-16 bg-muted/50">
          <div className="container max-w-lg px-4 md:px-6 text-center space-y-4 md:space-y-6">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Lock size={28} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">
              {t.joinPros.loginToBecome}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t.joinPros.loginMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2" asChild>
                <Link to="/auth?mode=signup&redirect=/join-pros">
                  {t.joinPros.createAccount} <ArrowRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white/80 hover:bg-white hover:text-primary" asChild>
                <Link to="/auth?mode=login&redirect=/join-pros">{t.nav.logIn}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
      </div>
    </Layout>
  );
}

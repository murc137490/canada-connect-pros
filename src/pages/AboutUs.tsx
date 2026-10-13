import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Handshake, Home, Sparkles } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import ColorBendsBackground from "@/components/ColorBendsBackground";
import { supabase } from "@/integrations/supabase/client";

export default function AboutUs() {
  const { t } = useLanguage();
  const a = t.about;
  const [memberCounts, setMemberCounts] = useState<{ users: number; professionals: number } | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke<{ users: number; professionals: number }>("public-member-count")
      .then(({ data, error }) => {
        if (
          active && !error &&
          Number.isSafeInteger(data?.users) && data.users >= 0 &&
          Number.isSafeInteger(data?.professionals) && data.professionals >= 0
        ) {
          setMemberCounts({ users: data.users, professionals: data.professionals });
        }
      });
    return () => { active = false; };
  }, []);

  return (
    <Layout>
      <div className="relative isolate min-h-screen overflow-hidden">
        <ColorBendsBackground />
        <section className="relative z-10 overflow-hidden border-b border-border/40">
          <div className="container relative px-4 md:px-6 pt-16 md:pt-24 pb-14 md:pb-20 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
              {a.eyebrow}
            </p>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-left text-foreground">
              {a.title}
            </h1>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {a.lead}
            </p>
          </div>
        </section>

        {memberCounts !== null && (
          <section className="container relative z-10 max-w-3xl px-4 md:px-6 pt-9" aria-label={a.memberCountTitle}>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-foreground">
              <div className="flex items-baseline gap-2">
                <AnimatedCounter value={memberCounts.professionals} className="text-foreground" fontSize={42} />
                <span className="text-sm font-medium text-muted-foreground sm:text-base">{a.memberCountProsLabel}</span>
              </div>
              <span aria-hidden="true" className="h-8 w-px bg-foreground/20" />
              <div className="flex items-baseline gap-2">
                <AnimatedCounter value={memberCounts.users} className="text-foreground" fontSize={42} />
                <span className="text-sm font-medium text-muted-foreground sm:text-base">{a.memberCountUsersLabel}</span>
              </div>
            </div>
          </section>
        )}

        <div className="container relative z-10 px-4 md:px-6 py-12 md:py-16 max-w-3xl space-y-14 md:space-y-16">
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

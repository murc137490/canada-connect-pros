import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Handshake, Home, Sparkles } from "lucide-react";
import ShapeGridBackground from "@/components/ShapeGridBackground";
import AnimatedCounter from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export default function AboutUs() {
  const { t } = useLanguage();
  const a = t.about;
  const [counts, setCounts] = useState<{ users: number; professionals: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      const { data, error } = await supabase.functions.invoke<{ users: number; professionals: number }>("public-member-count");
      if (!active || error || !data || !Number.isFinite(data.users) || !Number.isFinite(data.professionals)) return;
      setCounts({ users: data.users, professionals: data.professionals });
    };
    void loadCounts();
    const dailyRefresh = window.setInterval(() => void loadCounts(), 24 * 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(dailyRefresh); };
  }, []);

  return (
    <Layout>
      <div className="relative isolate min-h-screen overflow-hidden">
        <ShapeGridBackground />
        <section className="relative z-10 overflow-hidden">
          <div className="container relative grid max-w-6xl gap-10 px-4 pb-14 pt-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6 md:pb-20 md:pt-24">
            <div className="min-w-0 max-w-3xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {a.eyebrow}
              </p>
              <h1 className="font-heading text-left text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {a.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {a.lead}
              </p>
            </div>
            {counts && (
              <div className="grid grid-cols-2 gap-5 border-t border-border/40 pt-6 md:min-w-[18rem] md:grid-cols-1 md:gap-7 md:border-l md:border-t-0 md:pl-8 md:pt-0" aria-label={a.communityTitle}>
                <div>
                  <AnimatedCounter value={counts.professionals} className="text-foreground text-4xl sm:text-5xl" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">{a.professionalsCountLabel}</p>
                </div>
                <div>
                  <AnimatedCounter value={counts.users} className="text-foreground text-4xl sm:text-5xl" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">{a.usersCountLabel}</p>
                </div>
              </div>
            )}
          </div>
        </section>

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

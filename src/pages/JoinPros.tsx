import Layout from "@/components/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Users, Star, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import ProPlansContent from "@/components/ProPlansContent";
import type { ProPlanId } from "@/lib/proPlanPreview";
import { supabase } from "@/integrations/supabase/client";
import { useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";
import { useEffect, useState } from "react";
import { ProProfileEditorDialog } from "@/components/pro/ProProfileEditorDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HomeChapter from "@/components/HomeChapter";
import { useHomeScrollReveal } from "@/components/useHomeScrollReveal";

export default function JoinPros() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [proProfileId, setProProfileId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProPlanId | null>(null);
  const [missingProfileOpen, setMissingProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const { activeVerifiedPro } = useActiveVerifiedPro(user?.id);

  useHomeScrollReveal([user?.id, !!user]);

  useEffect(() => {
    if (activeVerifiedPro === true) {
      navigate("/dashboard?tab=pro", { replace: true });
    }
  }, [activeVerifiedPro, navigate]);

  useEffect(() => {
    if (!user) {
      setProProfileId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cancelled) setProProfileId(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const benefits = [
    { icon: TrendingUp, title: t.joinPros.growTitle, description: t.joinPros.growDesc },
    { icon: Users, title: t.joinPros.reachTitle, description: t.joinPros.reachDesc },
    { icon: Star, title: t.joinPros.buildTitle, description: t.joinPros.buildDesc },
    { icon: Shield, title: t.joinPros.secureTitle, description: t.joinPros.secureDesc },
  ];

  const easySteps = [
    { title: t.joinPros.easyStep1, description: t.joinPros.easyStep1Desc },
    { title: t.joinPros.easyStep2, description: t.joinPros.easyStep2Desc },
    { title: t.joinPros.easyStep3, description: t.joinPros.easyStep3Desc },
  ];

  const handleSelectPlan = (plan: ProPlanId) => {
    setSelectedPlan(plan);
    if (!proProfileId) {
      setMissingProfileOpen(true);
      return;
    }
    navigate("/pro-plans");
  };

  return (
    <Layout>
      <div className="min-h-screen">
        <section className="bg-primary text-primary-foreground">
          <div className="container px-4 py-14 text-center md:px-6 md:py-20">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70 md:text-sm">
              {t.joinPros.easyEyebrow}
            </p>
            <h1 className="mx-auto max-w-3xl font-heading text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.1]">
              {t.joinPros.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-primary-foreground/75 md:mt-5 md:text-lg">
              {t.joinPros.subtitle}
            </p>
            <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-white/25 bg-black/20 px-4 py-3 text-sm leading-relaxed text-primary-foreground/90 md:text-base">
              {locale === "fr" ? (
                <>
                  Vous pouvez créer un profil pro et explorer le tableau de bord.{" "}
                  <strong className="font-semibold text-white">
                    Les services ne sont pas annoncés dans la recherche client et ne peuvent pas être réservés tant que vous n’avez pas un forfait payant actif (Essentiel, Croissance ou Performance).
                  </strong>
                </>
              ) : (
                <>
                  You can create a pro profile and explore how the dashboard works.{" "}
                  <strong className="font-semibold text-white">
                    Services are not advertised in client search and cannot be booked until you have an active paid plan (Starter, Growth, or Pro).
                  </strong>
                </>
              )}
            </p>
            {!user && (
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  asChild
                >
                  <Link to="/auth?mode=signup&redirect=/join-pros">
                    {t.joinPros.createAccount} <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white hover:text-primary"
                  asChild
                >
                  <Link to="/auth?mode=login&redirect=/join-pros">{t.nav.logIn}</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <HomeChapter
          eyebrow={t.joinPros.easyEyebrow}
          title={t.joinPros.easyTitle}
          support={t.joinPros.easySupport}
          tone="muted"
          compact
        >
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3 md:gap-6">
            {easySteps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border/80 bg-card px-5 py-6 text-left shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-foreground md:text-lg">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </HomeChapter>

        <HomeChapter title={t.joinPros.readyTitle} support={t.joinPros.fillProfile} tone="default" compact>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-border/80 bg-card p-5 text-left shadow-sm transition-transform duration-200 hover:-translate-y-1 md:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10">
                  <b.icon size={22} className="text-secondary" />
                </div>
                <h3 className="mt-3 font-heading font-bold text-foreground">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </HomeChapter>

        {user ? (
          <section className="border-t border-border/60 bg-background py-12 md:py-16">
            <div className="container flex flex-col gap-8 px-4 md:px-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-heading text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                    {t.plans.title}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground md:text-base">{t.plans.subtitle}</p>
                </div>
                <Button
                  size="lg"
                  className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  type="button"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  {proProfileId ? t.joinPros.editProfile : t.joinPros.completeProfile}
                  <ArrowRight size={18} />
                </Button>
              </div>
              <ProPlansContent
                showCompleteProfileCta={false}
                interactive
                currentPlanId={null}
                onSelectPlan={handleSelectPlan}
              />
            </div>
          </section>
        ) : (
          <section className="border-t border-border/60 bg-muted/40 py-14 md:py-20">
            <div className="container max-w-lg space-y-5 px-4 text-center md:px-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 md:h-16 md:w-16">
                <Lock size={28} className="text-primary" />
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground md:text-2xl">
                {t.joinPros.loginToBecome}
              </h2>
              <p className="leading-relaxed text-muted-foreground">{t.joinPros.loginMessage}</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  asChild
                >
                  <Link to="/auth?mode=signup&redirect=/join-pros">
                    {t.joinPros.createAccount} <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/auth?mode=login&redirect=/join-pros">{t.nav.logIn}</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>

      <Dialog
        open={missingProfileOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
          setMissingProfileOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pro profile not created</DialogTitle>
            <DialogDescription>
              Do you want to finish setting up your pro profile before choosing a plan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2 sm:gap-0")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedPlan(null);
                setMissingProfileOpen(false);
              }}
            >
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMissingProfileOpen(false);
                setProfileEditorOpen(true);
              }}
            >
              {proProfileId ? t.joinPros.editProfile : t.joinPros.completeProfile}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProProfileEditorDialog
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
        allowDirectCreate
        onSaved={() => {
          void (async () => {
            if (!user) return;
            const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
            setProProfileId(data?.id ?? null);
          })();
        }}
      />
    </Layout>
  );
}

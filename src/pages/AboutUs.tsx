import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Handshake, Home, Sparkles } from "lucide-react";
import ShapeGridBackground from "@/components/ShapeGridBackground";
import AnimatedCounter from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export default function AboutUs() {
  const { t } = useLanguage();
  const a = t.about;
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ users: number; professionals: number } | null>(null);
  const [hasProAccount, setHasProAccount] = useState(false);
  const [target, setTarget] = useState<"client" | "professional" | "other">("client");
  const [otherTarget, setOtherTarget] = useState("");
  const [issue, setIssue] = useState("");
  const [solution, setSolution] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setHasProAccount(false);
      return;
    }
    void supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => { if (active) setHasProAccount(Boolean(data)); });
    return () => { active = false; };
  }, [user]);

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

  const submitRecommendation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || issue.trim().length < 8) return;
    setSending(true);
    setSent(false);
    setSendError(false);
    const { data, error } = await supabase.functions.invoke("site-recommendation", {
      body: { target, other_target: target === "other" ? otherTarget.trim() : "", issue: issue.trim(), solution: solution.trim() },
    });
    setSending(false);
    if (error || data?.error) {
      setSendError(true);
      return;
    }
    setSent(true);
    setIssue("");
    setSolution("");
    setOtherTarget("");
  };

  return (
    <Layout>
      <div className="relative isolate min-h-screen overflow-hidden">
        <ShapeGridBackground />
        <section className="relative z-10 overflow-hidden">
          <div className="container relative mx-auto max-w-6xl px-4 pb-14 pt-28 text-center md:px-6 md:pb-20 md:pt-28">
            {counts && (
              <div className="absolute right-4 top-4 grid grid-cols-2 gap-4 text-right md:right-6 md:top-6 md:gap-6" aria-label={a.communityTitle}>
                <div>
                  <AnimatedCounter value={counts.professionals} className="text-blue-500 text-2xl font-bold sm:text-3xl" />
                  <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{a.professionalsCountLabel}</p>
                </div>
                <div>
                  <AnimatedCounter value={counts.users} className="text-green-600 dark:text-green-500 text-2xl font-bold sm:text-3xl" />
                  <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{a.usersCountLabel}</p>
                </div>
              </div>
            )}
            <div className="mx-auto max-w-3xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {a.eyebrow}
              </p>
              <h1 className="font-heading text-center text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {a.title}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {a.lead}
              </p>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{a.growthNote}</p>
            </div>
          </div>
        </section>

        <div className="container relative z-10 mx-auto max-w-3xl space-y-14 px-4 py-12 md:space-y-16 md:px-6 md:py-16">
          <section className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <Home className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.granbyTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.granbyBody}</p>
          </section>

          <section className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.whoTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.whoBody}</p>
            <ul className="mx-auto mt-4 max-w-2xl space-y-3 text-left text-base leading-relaxed text-foreground/90">
              <li className="border-l-2 border-emerald-600/50 pl-4">{a.whoSmallBiz}</li>
              <li className="border-l-2 border-emerald-600/50 pl-4">{a.whoRetired}</li>
              <li className="border-l-2 border-emerald-600/50 pl-4">{a.whoAnyone}</li>
            </ul>
          </section>

          <section className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <Handshake className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <h2 className="font-heading text-2xl md:text-3xl font-bold">{a.exchangeTitle}</h2>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{a.exchangeBody}</p>
          </section>

          <section className="pt-2 pb-8 text-center md:pb-12">
            <p className="text-base md:text-lg text-foreground leading-relaxed mb-6">{a.ctaLead}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/join-pros">{a.ctaPro}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/make-request">{a.ctaClient}</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/80 p-5 text-left shadow-sm md:p-7" aria-labelledby="recommendation-title">
            <h2 id="recommendation-title" className="font-heading text-2xl font-bold text-foreground">{a.recommendationTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.recommendationIntro}</p>
            <form onSubmit={(event) => void submitRecommendation(event)} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label htmlFor="recommendation-target" className="text-sm font-medium">{a.recommendationTarget}</label>
                <select id="recommendation-target" value={target} onChange={(event) => setTarget(event.target.value as typeof target)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="client">{a.recommendationClient}</option>
                  {hasProAccount && <option value="professional">{a.recommendationPro}</option>}
                  <option value="other">{a.recommendationOther}</option>
                </select>
              </div>
              {target === "other" && <input value={otherTarget} onChange={(event) => setOtherTarget(event.target.value)} maxLength={100} required placeholder={a.recommendationOtherPlaceholder} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-foreground/50" />}
              <div className="space-y-2">
                <label htmlFor="recommendation-issue" className="text-sm font-medium">{a.recommendationIssue}</label>
                <Textarea id="recommendation-issue" value={issue} onChange={(event) => setIssue(event.target.value)} minLength={8} maxLength={3000} required placeholder={a.recommendationIssuePlaceholder} rows={4} />
              </div>
              <div className="space-y-2">
                <label htmlFor="recommendation-solution" className="text-sm font-medium">{a.recommendationSolution}</label>
                <Textarea id="recommendation-solution" value={solution} onChange={(event) => setSolution(event.target.value)} maxLength={3000} placeholder={a.recommendationSolutionPlaceholder} rows={3} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={sending || issue.trim().length < 8 || (target === "other" && !otherTarget.trim())} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? a.recommendationSending : a.recommendationSend}
                </Button>
                {sent && <p role="status" className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />{a.recommendationSent}</p>}
                {sendError && <p role="alert" className="text-sm text-destructive">{a.recommendationError}</p>}
              </div>
            </form>
          </section>
        </div>
      </div>
    </Layout>
  );
}

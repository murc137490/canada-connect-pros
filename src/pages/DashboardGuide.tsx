import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CheckCircle2, Compass, Lock, UserRound } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { markAllSegmentsCompleted, resetAllSegments, resetSegment, type DashTourSegment } from "@/lib/dashboardTutorial";

type Role = "client" | "pro";

type Section = {
  id: string;
  /** Dashboard tab this section lives in (null = separate page). */
  tab: "account" | "pro" | "bookings" | "favorites" | "reviews" | "invoices" | null;
  href?: string;
  tour?: DashTourSegment;
  /** Pro-only tabs stay locked until the pro application is approved. */
  needsApprovedPro?: boolean;
  en: { title: string; points: string[] };
  fr: { title: string; points: string[] };
};

const ACCOUNT: Section = {
  id: "account",
  tab: "account",
  tour: "account",
  en: {
    title: "My account",
    points: [
      "Update your name, phone, postal code and email language.",
      "Pick your username: it's your login ID and your public link (altshift.ca/yourname). Copy the link from the same card.",
      "Your 4-digit Member ID and optional voice PIN let you log in and identify yourself by phone.",
      "Verify your ID once so pros can confirm your bookings faster.",
    ],
  },
  fr: {
    title: "Mon compte",
    points: [
      "Modifiez votre nom, téléphone, code postal et langue des courriels.",
      "Choisissez votre nom d’utilisateur : c’est votre identifiant de connexion et votre lien public (altshift.ca/votrenom). Copiez le lien dans la même carte.",
      "Votre numéro de membre à 4 chiffres et votre NIP vocal (optionnel) servent à vous connecter et à vous identifier par téléphone.",
      "Vérifiez votre identité une fois pour que les pros confirment vos réservations plus vite.",
    ],
  },
};

const CLIENT_SECTIONS: Section[] = [
  ACCOUNT,
  {
    id: "bookings",
    tab: "bookings",
    en: {
      title: "Bookings",
      points: [
        "Follow each request from pending to confirmed to completed.",
        "Cancel or reschedule within the pro's cancellation policy.",
        "Quotes from pros for jobs you posted show up under Received quotes.",
        "Use Book again on a past booking to rebook the same pro.",
      ],
    },
    fr: {
      title: "Réservations",
      points: [
        "Suivez chaque demande : en attente, confirmée, terminée.",
        "Annulez ou déplacez selon la politique d’annulation du pro.",
        "Les soumissions des pros pour vos jobs publiées apparaissent sous Soumissions reçues.",
        "Utilisez Réserver à nouveau sur une réservation passée pour revoir le même pro.",
      ],
    },
  },
  {
    id: "post-job",
    tab: null,
    href: "/make-request",
    en: {
      title: "Post a job",
      points: [
        "Describe what you need, where, and when. Local pros send you quotes.",
        "Compare quotes in Bookings, then accept the one you like.",
      ],
    },
    fr: {
      title: "Publier une job",
      points: [
        "Décrivez ce dont vous avez besoin, où et quand. Les pros du coin vous envoient des soumissions.",
        "Comparez-les dans Réservations, puis acceptez celle qui vous convient.",
      ],
    },
  },
  {
    id: "favorites",
    tab: "favorites",
    en: { title: "Favorites", points: ["Tap the heart on a pro's page to save them here for next time."] },
    fr: { title: "Favoris", points: ["Touchez le cœur sur la page d’un pro pour le retrouver ici la prochaine fois."] },
  },
  {
    id: "reviews",
    tab: "reviews",
    tour: "reviews",
    en: {
      title: "Reviews",
      points: [
        "After a completed booking, rate your pro and add photos.",
        "Leaving your review unlocks the other reviews on that pro.",
      ],
    },
    fr: {
      title: "Avis",
      points: [
        "Après une réservation terminée, notez votre pro et ajoutez des photos.",
        "Laisser votre avis déverrouille les autres avis sur ce pro.",
      ],
    },
  },
  {
    id: "invoices",
    tab: "invoices",
    tour: "invoices",
    en: { title: "Invoices", points: ["Every payment has a receipt with the service amount, platform fee and taxes."] },
    fr: { title: "Factures", points: ["Chaque paiement a un reçu : montant du service, frais de plateforme et taxes."] },
  },
  {
    id: "invite",
    tab: null,
    en: {
      title: "Invite a friend",
      points: ["Open the menu under your name and choose Invite a friend to send your invite."],
    },
    fr: {
      title: "Inviter un ami",
      points: ["Ouvrez le menu sous votre nom et choisissez Inviter un ami pour envoyer votre invitation."],
    },
  },
];

const PRO_SECTIONS: Section[] = [
  ACCOUNT,
  {
    id: "pro",
    tab: "pro",
    tour: "pro",
    needsApprovedPro: true,
    en: {
      title: "Pro profile",
      points: [
        "Your stats, photo, services, prices and portfolio.",
        "Connect Square to get paid, and pick your page colours (Growth and Pro plans).",
        "Your public page lives at altshift.ca/yourusername. Share it anywhere.",
      ],
    },
    fr: {
      title: "Profil pro",
      points: [
        "Vos statistiques, photo, services, prix et portfolio.",
        "Connectez Square pour être payé et choisissez les couleurs de votre page (forfaits Croissance et Pro).",
        "Votre page publique est altshift.ca/votrenomdutilisateur. Partagez-la partout.",
      ],
    },
  },
  {
    id: "bookings",
    tab: "bookings",
    tour: "bookings",
    needsApprovedPro: true,
    en: {
      title: "Bookings & schedule",
      points: [
        "Set your weekly availability and block off days or hours.",
        "Accept or decline booking requests; recurring series show as a group.",
        "Growth tools: client history and rebook reminders (Growth plan).",
      ],
    },
    fr: {
      title: "Réservations et horaire",
      points: [
        "Réglez vos disponibilités et bloquez des jours ou des heures.",
        "Acceptez ou refusez les demandes; les séries récurrentes sont regroupées.",
        "Outils Croissance : historique client et rappels de réservation (forfait Croissance).",
      ],
    },
  },
  {
    id: "reviews",
    tab: "reviews",
    tour: "reviews",
    en: { title: "Reviews", points: ["Read and answer client reviews; leave a review for clients after a job."] },
    fr: { title: "Avis", points: ["Lisez les avis de vos clients et laissez un avis aux clients après une job."] },
  },
  {
    id: "invoices",
    tab: "invoices",
    tour: "invoices",
    en: { title: "Invoices", points: ["Each payout shows the service amount, platform fee and taxes (GST/QST)."] },
    fr: { title: "Factures", points: ["Chaque paiement affiche le montant du service, les frais de plateforme et les taxes (TPS/TVQ)."] },
  },
  {
    id: "plan",
    tab: null,
    href: "/pro-plans",
    en: { title: "My plan", points: ["See your plan, trial days left, upgrade or cancel."] },
    fr: { title: "Mon forfait", points: ["Voyez votre forfait, les jours d’essai restants, changez ou annulez."] },
  },
];

function useDashboardRole(userId: string | undefined) {
  const [state, setState] = useState<{ role: Role; approved: boolean; ready: boolean }>({
    role: "client",
    approved: false,
    ready: !userId,
  });
  useEffect(() => {
    if (!userId) {
      setState({ role: "client", approved: false, ready: true });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, ready: false }));
    void supabase
      .from("pro_profiles")
      .select("is_verified")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setState({ role: data ? "pro" : "client", approved: Boolean(data?.is_verified), ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return state;
}

export default function DashboardGuide() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const fr = locale === "fr";
  const detected = useDashboardRole(user?.id);
  const [roleOverride, setRoleOverride] = useState<Role | null>(null);
  const role = roleOverride ?? detected.role;
  const sections = role === "pro" ? PRO_SECTIONS : CLIENT_SECTIONS;
  const isOwnRole = !user || role === detected.role;
  const [doneFlash, setDoneFlash] = useState(false);

  /** Logged-out visitors sign in first and come straight back to the right place. */
  const dest = useMemo(
    () => (path: string) => (user ? path : `/auth?mode=login&redirect=${encodeURIComponent(path)}`),
    [user],
  );

  const tourStart = dest("/dashboard?tab=account&tour=1");

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{fr ? "Aide" : "Help"}</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground md:text-4xl">
          {fr ? "Guide du tableau de bord" : "Dashboard guide"}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {role === "pro"
            ? fr
              ? "Tout ce que votre tableau de bord pro permet de faire, section par section. La visite guidée commence par Mon compte."
              : "Everything your pro dashboard does, section by section. The guided tour starts with My account."
            : fr
              ? "Tout ce que votre tableau de bord permet de faire, section par section. La visite guidée commence par Mon compte."
              : "Everything your dashboard does, section by section. The guided tour starts with My account."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button asChild size="lg" className="gap-2">
            <Link
              to={tourStart}
              onClick={() => {
                if (user?.id) resetSegment(user.id, "account");
              }}
            >
              <Compass className="h-4 w-4" aria-hidden />
              {user
                ? fr
                  ? "Commencer la visite (Mon compte)"
                  : "Start the tour (My account)"
                : fr
                  ? "Se connecter pour commencer"
                  : "Log in to start"}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={dest("/dashboard?tab=account")}>{fr ? "Ouvrir mon compte" : "Open my account"}</Link>
          </Button>
        </div>

        <div className="mt-8 inline-flex rounded-full border bg-muted/40 p-1" role="tablist" aria-label={fr ? "Type de compte" : "Account type"}>
          {(["client", "pro"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => setRoleOverride(r)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                role === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "pro" ? <Briefcase className="h-4 w-4" aria-hidden /> : <UserRound className="h-4 w-4" aria-hidden />}
              {r === "pro" ? (fr ? "Pro" : "Pro") : fr ? "Client" : "Client"}
              {user && detected.ready && detected.role === r ? (
                <span className="ml-1 rounded-full bg-primary/10 px-2 text-[11px] text-primary">{fr ? "vous" : "you"}</span>
              ) : null}
            </button>
          ))}
        </div>

        <ol className="mt-8 space-y-4">
          {sections.map((s, i) => {
            const copy = fr ? s.fr : s.en;
            const locked = Boolean(user && isOwnRole && s.needsApprovedPro && role === "pro" && !detected.approved);
            const openPath = s.href ?? (s.tab ? `/dashboard?tab=${s.tab}` : null);
            return (
              <li key={`${role}-${s.id}`} className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-lg font-bold text-foreground">{copy.title}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {copy.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    {locked ? (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        {fr ? "Disponible une fois votre profil pro approuvé." : "Available once your pro profile is approved."}
                      </p>
                    ) : isOwnRole && (openPath || s.tour) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {openPath ? (
                          <Button asChild size="sm" variant="outline" className="gap-1">
                            <Link to={dest(openPath)}>
                              {fr ? "Ouvrir" : "Open"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </Button>
                        ) : null}
                        {s.tour && user ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to={`/dashboard?tab=${s.tab}&tour=1`}
                              onClick={() => {
                                if (user?.id && s.tour) resetSegment(user.id, s.tour);
                              }}
                            >
                              {fr ? "Me montrer" : "Show me"}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {user?.id ? (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-6">
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to="/dashboard?tab=account&tour=1" onClick={() => resetAllSegments(user.id)}>
                {fr ? "Tout relancer" : "Replay everything"}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                markAllSegmentsCompleted(user.id);
                setDoneFlash(true);
                window.setTimeout(() => setDoneFlash(false), 2000);
              }}
            >
              {doneFlash ? <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" aria-hidden /> : null}
              {fr ? "Ne plus afficher la visite automatiquement" : "Stop showing the tour automatically"}
            </Button>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

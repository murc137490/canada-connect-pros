import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DASH_TOUR_SEGMENTS,
  DASH_TOUR_TAB,
  type DashTourSegment,
  markAllSegmentsCompleted,
  resetAllSegments,
  resetSegment,
} from "@/lib/dashboardTutorial";

const SEGMENT_META: Record<
  DashTourSegment,
  { titleEn: string; titleFr: string; blurbEn: string; blurbFr: string }
> = {
  account: {
    titleEn: "My account",
    titleFr: "Mon compte",
    blurbEn: "Personal info, languages, postal code, booking ID verification, and cancellation policy.",
    blurbFr: "Infos personnelles, langues, code postal, vérification d’identité et politique d’annulation.",
  },
  pro: {
    titleEn: "Pro profile",
    titleFr: "Profil pro",
    blurbEn: "Stats, photo, Square Connect, featured design, services, and portfolio.",
    blurbFr: "Stats, photo, Square, apparence, services et portfolio.",
  },
  bookings: {
    titleEn: "Bookings & schedule",
    titleFr: "Réservations et horaire",
    blurbEn: "Calendar availability, blocked hours, Starter 30-day window, and booking requests.",
    blurbFr: "Calendrier, plages bloquées, fenêtre Essentiel 30 jours et demandes.",
  },
  reviews: {
    titleEn: "Reviews",
    titleFr: "Avis",
    blurbEn: "Leave a review to unlock others; stars stay hidden while locked.",
    blurbFr: "Laissez un avis pour déverrouiller les autres; étoiles masquées tant que c’est verrouillé.",
  },
  invoices: {
    titleEn: "Invoices",
    titleFr: "Factures",
    blurbEn: "Service amount, platform fee, and tax breakdown on each invoice.",
    blurbFr: "Montant du service, frais de plateforme et taxes sur chaque facture.",
  },
};

export default function DashboardGuide() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const fr = locale === "fr";

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {fr ? "Aide" : "Help"}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground md:text-4xl">
          {fr ? "Guide du tableau de bord" : "Dashboard guide"}
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {fr
            ? "Tutoriel segmenté pour les professionnels. Relancez une section ou le guide complet. Les clients verront un parcours plus court plus tard."
            : "Segmented tutorial for professionals. Replay one section or the full guide. Clients can get a shorter tour later."}
        </p>

        <ul className="mt-10 space-y-6">
          {DASH_TOUR_SEGMENTS.map((segment) => {
            const meta = SEGMENT_META[segment];
            const tab = DASH_TOUR_TAB[segment];
            return (
              <li key={segment} className="border-b border-border/60 pb-6 last:border-0">
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {fr ? meta.titleFr : meta.titleEn}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{fr ? meta.blurbFr : meta.blurbEn}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link
                    to={`/dashboard?tab=${tab}&tour=1`}
                    onClick={() => {
                      if (user?.id) resetSegment(user.id, segment);
                    }}
                  >
                    {fr ? "Relancer" : "Replay"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 rounded-xl border border-border/70 bg-muted/30 p-4">
          <h2 className="font-heading text-base font-bold text-foreground">
            {fr ? "Favoris" : "Favorites"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fr
              ? "Enregistrez des pros depuis leur page pour les retrouver vite dans l’onglet Favoris du tableau de bord."
              : "Save pros from their page to find them quickly under the Favorites tab in your dashboard."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {user?.id ? (
            <>
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link
                  to="/dashboard?tab=account&tour=1"
                  onClick={() => resetAllSegments(user.id)}
                >
                  {fr ? "Tout relancer" : "Replay all"}
                </Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => markAllSegmentsCompleted(user.id)}>
                {fr ? "Marquer comme terminé" : "Mark all done"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to="/auth">{fr ? "Se connecter pour le tutoriel" : "Sign in for the tutorial"}</Link>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/dashboard">{fr ? "Ouvrir le tableau de bord" : "Open dashboard"}</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}

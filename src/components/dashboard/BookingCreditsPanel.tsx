import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

type CreditSummary = {
  available: number;
  monthly: number;
  usedThisMonth: number;
  bookedValueCents: number;
  activity: { id: string; type: string; amount: number; createdAt: string }[];
};

/** Professional-only activity backed by the RLS-protected credit tables. */
export default function BookingCreditsPanel({ proProfileId }: { proProfileId: string }) {
  const { locale } = useLanguage();
  const fr = locale === "fr";
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  useEffect(() => {
    let active = true;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    void Promise.all([
      supabase.from("booking_credit_grants").select("id, grant_type, granted, remaining, expires_at")
        .eq("pro_profile_id", proProfileId).order("created_at", { ascending: false }).limit(100),
      supabase.from("booking_credit_ledger").select("id, transaction_type, credit_amount, created_at")
        .eq("pro_profile_id", proProfileId).order("created_at", { ascending: false }).limit(20),
      supabase.from("booking_credit_reservations").select("eligible_value_cents, status, created_at")
        .eq("pro_profile_id", proProfileId).gte("created_at", startIso).limit(500),
    ]).then(([grants, ledger, reservations]) => {
      if (!active) return;
      if (grants.error || ledger.error || reservations.error) { setSummary(null); return; }
      const now = Date.now();
      const validGrants = grants.data ?? [];
      const activeGrant = (grant: (typeof validGrants)[number]) => !grant.expires_at || Date.parse(grant.expires_at) > now;
      const available = validGrants.filter(activeGrant).reduce((sum, grant) => sum + Number(grant.remaining || 0), 0);
      const monthly = validGrants.filter((grant) => grant.grant_type === "subscription" && activeGrant(grant))
        .reduce((sum, grant) => sum + Number(grant.granted || 0), 0);
      const ledgerRows = ledger.data ?? [];
      const usedThisMonth = ledgerRows.filter((row) => row.transaction_type === "booking_credit_consumption" && row.created_at >= startIso)
        .reduce((sum, row) => sum + Number(row.credit_amount || 0), 0);
      const bookedValueCents = (reservations.data ?? []).filter((row) => row.status === "consumed")
        .reduce((sum, row) => sum + Number(row.eligible_value_cents || 0), 0);
      setSummary({
        available,
        monthly,
        usedThisMonth,
        bookedValueCents,
        activity: ledgerRows.slice(0, 6).map((row) => ({ id: row.id, type: row.transaction_type, amount: Number(row.credit_amount), createdAt: row.created_at })),
      });
    }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [proProfileId]);
  return (
    <section className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-1 text-foreground" aria-label={fr ? "Crédits de réservation" : "Booking Credits"}>
      <div className="flex items-center gap-2">
        <Coins size={17} className="text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">{fr ? "Crédit" : "Credit"}</span>
        <span className="text-sm font-bold tabular-nums">
          {summary === null ? ";" : `${summary.available}${summary.monthly ? `/${summary.monthly}` : ""}`}
        </span>
        {summary ? <span className="text-xs text-muted-foreground">· {fr ? "utilisés" : "used"} {summary.usedThisMonth}</span> : null}
      </div>
      <details className="basis-full pt-1 text-xs text-muted-foreground md:basis-auto md:pt-0">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground">
          <History size={13} aria-hidden="true" />{fr ? "Détails et activité" : "Details and activity"}
        </summary>
        <p className="mt-2 leading-relaxed">
          {fr
            ? "Les demandes et les devis n’utilisent pas de crédits. Les crédits sont réservés à l’acceptation et consommés lorsque le travail est terminé."
            : "Requests and quotes don't use credits. Credits are reserved when a booking is accepted and consumed when the work is completed."}
        </p>
        <Link to="/pro-plans" className="mt-2 inline-block font-semibold text-primary underline-offset-4 hover:underline">{fr ? "Gérer le forfait" : "Manage plan"}</Link>
        {summary ? (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <span>{fr ? "Crédits utilisés ce mois-ci" : "Credits used this month"}: {summary.usedThisMonth}</span>
            <span>{fr ? "Valeur des réservations terminées" : "Completed booking value"}: ${(summary.bookedValueCents / 100).toFixed(2)} CAD</span>
          </div>
        ) : null}
        {summary?.activity.length ? (
          <ul className="mt-2 space-y-1">
            {summary.activity.map((row) => <li key={row.id} className="flex justify-between gap-4"><span>{row.type.replace(/_/g, " ")}</span><span>−{row.amount} · {new Date(row.createdAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")}</span></li>)}
          </ul>
        ) : null}
      </details>
    </section>
  );
}

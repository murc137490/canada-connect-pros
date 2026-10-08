import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { untypedDb } from "@/lib/untypedSupabase";
import { GROWTH_COPY, hasGrowthTools, type Lang } from "@/lib/growthTools";
import type { ProPlanId } from "@/lib/proPlanPreview";
import ProClientHistoryPanel, { type CrmBooking, type CrmClient } from "./ProClientHistoryPanel";
import ProRebookReminderSettings from "./ProRebookReminderSettings";
import BookingSeriesPanel from "./BookingSeriesPanel";
import RepeatBookingDialog from "./RepeatBookingDialog";

type Props = {
  proProfileId: string;
  lang: Lang;
  tier: ProPlanId | null;
};

/** Growth & Pro tools for the pro dashboard: CRM, returning-customer reminders, repeat bookings. */
export default function ProGrowthTools({ proProfileId, lang, tier }: Props) {
  const enabled = hasGrowthTools(tier);
  const g = GROWTH_COPY[lang];
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(8);
  const [repeatTarget, setRepeatTarget] = useState<CrmBooking | null>(null);
  const [seriesKey, setSeriesKey] = useState(0);

  const loadClients = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data, error } = await untypedDb.rpc("pro_client_history", { p_pro_profile_id: proProfileId });
    if (!error && Array.isArray(data)) setClients(data as CrmClient[]);
    setLoading(false);
  }, [enabled, proProfileId]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const clientNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) if (c.client_name) m[c.client_id] = c.client_name;
    return m;
  }, [clients]);

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1 flex items-center gap-2">
          <Lock className="size-4" aria-hidden />
          {lang === "fr"
            ? "Historique clients, rappels aux clients récurrents et réservations répétées"
            : "Client history, returning-customer reminders and repeat bookings"}
        </p>
        <p>{g.locked}</p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to="/pro-plans">{g.upgrade}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pro-growth-tools">
      <ProClientHistoryPanel
        proProfileId={proProfileId}
        lang={lang}
        clients={clients}
        loading={loading}
        reminderWeeks={weeks}
        onChanged={() => void loadClients()}
        onSetupRepeat={(b) => setRepeatTarget(b)}
      />
      <ProRebookReminderSettings proProfileId={proProfileId} lang={lang} onWeeksChange={setWeeks} />
      <BookingSeriesPanel role="pro" lang={lang} proProfileId={proProfileId} clientNames={clientNames} refreshKey={seriesKey} />
      <RepeatBookingDialog
        open={repeatTarget != null}
        onOpenChange={(o) => {
          if (!o) setRepeatTarget(null);
        }}
        bookingId={repeatTarget?.id ?? null}
        bookingDate={repeatTarget?.date ?? null}
        role="pro"
        lang={lang}
        onCreated={() => setSeriesKey((k) => k + 1)}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { untypedDb } from "@/lib/untypedSupabase";
import { GROWTH_COPY, formatYmd, growthErrorMessage, serviceSlugLabel, type Lang, type SeriesStatus } from "@/lib/growthTools";

export type BookingSeriesRow = {
  id: string;
  pro_profile_id: string;
  client_id: string;
  frequency: string;
  preferred_time: string | null;
  service_slug: string | null;
  service_category_slug: string | null;
  next_date: string;
  status: SeriesStatus;
  proposed_by: "client" | "pro";
  last_skip_reason: string | null;
  pro_profiles?: { business_name: string | null } | null;
};

type Props = {
  role: "client" | "pro";
  lang: Lang;
  /** pro: their pro_profile id. client: ignored. */
  proProfileId?: string | null;
  /** client: the signed-in user id. */
  userId?: string | null;
  /** pro: client display names keyed by client_id (from the CRM list). */
  clientNames?: Record<string, string>;
  /** Bump to reload (e.g. after creating a series elsewhere). */
  refreshKey?: number;
  /** client: render nothing when there are no series. */
  hideWhenEmpty?: boolean;
};

export default function BookingSeriesPanel({ role, lang, proProfileId, userId, clientNames, refreshKey, hideWhenEmpty }: Props) {
  const c = GROWTH_COPY[lang].series;
  const { toast } = useToast();
  const [rows, setRows] = useState<BookingSeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const load = useCallback(async () => {
    const scopeId = role === "pro" ? proProfileId : userId;
    if (!scopeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = untypedDb
      .from("booking_series")
      .select("id, pro_profile_id, client_id, frequency, preferred_time, service_slug, service_category_slug, next_date, status, proposed_by, last_skip_reason, pro_profiles(business_name)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(100);
    q = role === "pro" ? q.eq("pro_profile_id", scopeId) : q.eq("client_id", scopeId);
    const { data, error } = await q;
    if (!error) setRows((data ?? []) as unknown as BookingSeriesRow[]);
    if (role === "pro") {
      const { data: pp } = await untypedDb.from("pro_profiles").select("recurring_auto_approve").eq("id", scopeId).maybeSingle();
      setAutoApprove(Boolean((pp as { recurring_auto_approve?: boolean } | null)?.recurring_auto_approve));
    }
    setLoading(false);
  }, [role, proProfileId, userId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const act = async (id: string, action: "pause" | "resume" | "cancel" | "accept" | "decline") => {
    if (action === "cancel" && !window.confirm(c.confirmCancel)) return;
    setBusyId(id);
    const { error } = await untypedDb.rpc("booking_series_update", { p_series_id: id, p_action: action });
    setBusyId(null);
    if (error) {
      toast({ title: c.title, description: growthErrorMessage(error, lang), variant: "destructive" });
      return;
    }
    toast({ title: c.updated });
    void load();
  };

  const saveAuto = async (next: boolean) => {
    if (!proProfileId) return;
    setSavingAuto(true);
    setAutoApprove(next);
    const { error } = await untypedDb.from("pro_profiles").update({ recurring_auto_approve: next }).eq("id", proProfileId);
    setSavingAuto(false);
    if (error) {
      setAutoApprove(!next);
      toast({ title: c.autoApprove, description: growthErrorMessage(error, lang), variant: "destructive" });
    }
  };

  if (hideWhenEmpty && !loading && rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Repeat className="size-4" aria-hidden /> {c.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{role === "pro" ? c.introPro : c.introClient}</p>
      </div>
      {role === "pro" ? (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div>
            <Label htmlFor="series-auto-approve" className="font-medium">{c.autoApprove}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">{c.autoApproveHint}</p>
          </div>
          <Switch id="series-auto-approve" checked={autoApprove} disabled={savingAuto || loading} onCheckedChange={(v) => void saveAuto(v)} />
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {lang === "fr" ? "Chargement…" : "Loading…"}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const who =
              role === "pro"
                ? clientNames?.[s.client_id] || GROWTH_COPY[lang].crm.unnamed
                : s.pro_profiles?.business_name || "AltShift Pro";
            const busy = busyId === s.id;
            const awaitingClient = s.status === "proposed" && s.proposed_by === "pro";
            return (
              <li key={s.id} className="rounded-lg border border-border/70 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{who}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.freq[s.frequency] ?? s.frequency}
                      {s.service_slug ? ` · ${serviceSlugLabel(s.service_slug)}` : ""}
                      {s.preferred_time ? ` · ${String(s.preferred_time).slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>
                    {role === "client" && awaitingClient ? c.proposedToYou : c.statusLabel[s.status] ?? s.status}
                  </Badge>
                </div>
                {s.status !== "proposed" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.next}: {formatYmd(s.next_date, lang)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {role === "client" && awaitingClient ? (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => void act(s.id, "accept")}>{c.accept}</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(s.id, "decline")}>{c.decline}</Button>
                    </>
                  ) : null}
                  {s.status === "active" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(s.id, "pause")}>{c.pause}</Button>
                  ) : null}
                  {s.status === "paused" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(s.id, "resume")}>{c.resume}</Button>
                  ) : null}
                  {!(role === "client" && awaitingClient) ? (
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void act(s.id, "cancel")}>
                      {c.cancel}
                    </Button>
                  ) : null}
                  {busy ? <Loader2 className="size-4 animate-spin self-center" /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

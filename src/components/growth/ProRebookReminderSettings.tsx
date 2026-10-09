import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { untypedDb } from "@/lib/untypedSupabase";
import { GROWTH_COPY, growthErrorMessage, type Lang } from "@/lib/growthTools";
import { fetchMyProProfile } from "@/lib/proProfileAccess";

const WEEK_OPTIONS = [2, 4, 6, 8, 12, 26, 52];

type Props = {
  proProfileId: string;
  lang: Lang;
  onWeeksChange?: (weeks: number) => void;
};

export default function ProRebookReminderSettings({ proProfileId, lang, onWeeksChange }: Props) {
  const c = GROWTH_COPY[lang].reminders;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const [sent, setSent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data }, { count }] = await Promise.all([
        fetchMyProProfile("rebook_reminder_enabled, rebook_reminder_weeks"),
        untypedDb.from("rebook_nudges").select("id", { count: "exact", head: true }).eq("pro_profile_id", proProfileId).eq("status", "sent"),
      ]);
      if (cancelled) return;
      const row = data as { rebook_reminder_enabled?: boolean; rebook_reminder_weeks?: number } | null;
      setEnabled(Boolean(row?.rebook_reminder_enabled));
      const w = Number(row?.rebook_reminder_weeks) || 8;
      setWeeks(w);
      onWeeksChange?.(w);
      setSent(typeof count === "number" ? count : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proProfileId]);

  const save = async () => {
    setSaving(true);
    const { error } = await untypedDb
      .from("pro_profiles")
      .update({ rebook_reminder_enabled: enabled, rebook_reminder_weeks: weeks })
      .eq("id", proProfileId);
    setSaving(false);
    if (error) {
      toast({ title: c.title, description: growthErrorMessage(error, lang), variant: "destructive" });
      return;
    }
    onWeeksChange?.(weeks);
    toast({ title: c.saved });
  };

  const weekOptions = WEEK_OPTIONS.includes(weeks) ? WEEK_OPTIONS : [...WEEK_OPTIONS, weeks].sort((a, b) => a - b);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <BellRing className="size-4" aria-hidden /> {c.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{c.intro}</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {lang === "fr" ? "Chargement…" : "Loading…"}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rebook-enabled" className="font-medium">{c.enable}</Label>
            <Switch id="rebook-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Label>{c.after}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekOptions.map((w) => (
                <Button key={w} type="button" size="sm" variant={weeks === w ? "default" : "outline"} disabled={!enabled} onClick={() => setWeeks(w)}>
                  {w} {c.weeks}
                </Button>
              ))}
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{c.howEmail}</li>
            <li>{c.rules}</li>
            <li>{c.renewNote}</li>
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{sent != null ? c.sentCount.replace("{{n}}", String(sent)) : ""}</p>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              {c.save}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

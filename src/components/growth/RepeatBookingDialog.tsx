import { useEffect, useMemo, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { untypedDb } from "@/lib/untypedSupabase";
import {
  GROWTH_COPY,
  addDaysYmd,
  addMonthsYmd,
  growthErrorMessage,
  todayYmdToronto,
  type Lang,
  type SeriesFrequency,
} from "@/lib/growthTools";

const FREQS: SeriesFrequency[] = ["weekly", "biweekly", "monthly"];

function stepYmd(ymd: string, f: SeriesFrequency): string {
  if (f === "weekly") return addDaysYmd(ymd, 7);
  if (f === "biweekly") return addDaysYmd(ymd, 14);
  return addMonthsYmd(ymd, 1);
}

/** First visit after today, stepping from the template booking's date. */
export function defaultFirstDate(templateYmd: string | null | undefined, f: SeriesFrequency): string {
  const today = todayYmdToronto();
  let d = templateYmd && /^\d{4}-\d{2}-\d{2}/.test(templateYmd) ? templateYmd.slice(0, 10) : today;
  for (let i = 0; i < 400 && d <= today; i++) d = stepYmd(d, f);
  const max = addDaysYmd(today, 120);
  return d > max ? addDaysYmd(today, 1) : d;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  bookingDate?: string | null;
  role: "client" | "pro";
  lang: Lang;
  title?: string;
  onCreated?: () => void;
};

export default function RepeatBookingDialog({ open, onOpenChange, bookingId, bookingDate, role, lang, title, onCreated }: Props) {
  const c = GROWTH_COPY[lang].series;
  const { toast } = useToast();
  const [freq, setFreq] = useState<SeriesFrequency>("biweekly");
  const [firstDate, setFirstDate] = useState<string>(() => defaultFirstDate(bookingDate, "biweekly"));
  const [touchedDate, setTouchedDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const minDate = useMemo(() => addDaysYmd(todayYmdToronto(), 1), []);
  const maxDate = useMemo(() => addDaysYmd(todayYmdToronto(), 120), []);

  useEffect(() => {
    if (!open) return;
    setFreq("biweekly");
    setTouchedDate(false);
    setFirstDate(defaultFirstDate(bookingDate, "biweekly"));
  }, [open, bookingDate]);

  useEffect(() => {
    if (!touchedDate) setFirstDate(defaultFirstDate(bookingDate, freq));
  }, [freq, bookingDate, touchedDate]);

  const submit = async () => {
    if (!bookingId) return;
    setSaving(true);
    const { error } = await untypedDb.rpc("booking_series_create", {
      p_template_booking_id: bookingId,
      p_frequency: freq,
      p_first_date: firstDate,
    });
    setSaving(false);
    if (error) {
      toast({ title: c.setupTitle, description: growthErrorMessage(error, lang), variant: "destructive" });
      return;
    }
    toast({ title: role === "client" ? c.created : c.proposed });
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="size-4" aria-hidden /> {title ?? c.setupTitle}
          </DialogTitle>
          <DialogDescription>{role === "client" ? c.setupIntro : c.setupIntroPro}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{c.frequency}</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FREQS.map((f) => (
                <Button key={f} type="button" size="sm" variant={freq === f ? "default" : "outline"} onClick={() => setFreq(f)}>
                  {c.freq[f]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="repeat-first-date">{c.firstDate}</Label>
            <Input
              id="repeat-first-date"
              type="date"
              className="mt-1"
              min={minDate}
              max={maxDate}
              value={firstDate}
              onChange={(e) => {
                setTouchedDate(true);
                setFirstDate(e.target.value);
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {lang === "fr" ? "Fermer" : "Close"}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !firstDate}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            {role === "client" ? c.create : c.propose}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

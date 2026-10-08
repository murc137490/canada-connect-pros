import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Repeat, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { untypedDb } from "@/lib/untypedSupabase";
import { GROWTH_COPY, addDaysYmd, addMonthsYmd, formatMoneyCents, formatYmd, growthErrorMessage, serviceSlugLabel, type Lang } from "@/lib/growthTools";

export type CrmBooking = {
  id: string;
  status: string;
  date: string | null;
  time: string | null;
  service_category_slug: string | null;
  service_slug: string | null;
  duration_minutes: number | null;
  paid_cents: number | null;
  code: string | null;
  series_id: string | null;
  renewal_interval_months: number | null;
};

export type CrmClient = {
  client_id: string;
  client_name: string | null;
  total_bookings: number;
  completed_count: number;
  cancelled_count: number;
  total_paid_cents: number;
  last_visit: string | null;
  next_visit: string | null;
  last_activity: string | null;
  note: string | null;
  bookings: CrmBooking[];
};

type Props = {
  proProfileId: string;
  lang: Lang;
  clients: CrmClient[];
  loading: boolean;
  reminderWeeks: number;
  onChanged: () => void;
  onSetupRepeat: (booking: CrmBooking) => void;
};

function suggestedNext(c: CrmClient, weeks: number): string | null {
  if (c.next_visit || !c.last_visit) return null;
  const anchor = c.bookings.find((b) => b.status === "completed" && b.date === c.last_visit);
  const months = anchor?.renewal_interval_months;
  if (months && months > 0) return addMonthsYmd(c.last_visit, months);
  return addDaysYmd(c.last_visit, weeks * 7);
}

export default function ProClientHistoryPanel({ proProfileId, lang, clients, loading, reminderWeeks, onChanged, onSetupRepeat }: Props) {
  const c = GROWTH_COPY[lang].crm;
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((cl) => (cl.client_name ?? "").toLowerCase().includes(q) || (cl.note ?? "").toLowerCase().includes(q));
  }, [clients, query]);

  const saveNote = async (cl: CrmClient) => {
    const note = (drafts[cl.client_id] ?? cl.note ?? "").slice(0, 4000);
    setSavingId(cl.client_id);
    const { error } = await untypedDb
      .from("pro_client_notes")
      .upsert({ pro_profile_id: proProfileId, client_id: cl.client_id, note }, { onConflict: "pro_profile_id,client_id" });
    setSavingId(null);
    if (error) {
      toast({ title: c.notes, description: growthErrorMessage(error, lang), variant: "destructive" });
      return;
    }
    toast({ title: c.noteSaved });
    onChanged();
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="size-4" aria-hidden /> {c.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{c.intro}</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {lang === "fr" ? "Chargement…" : "Loading…"}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <>
          {clients.length > 5 ? (
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} aria-label={c.search} />
          ) : null}
          <ul className="space-y-2">
            {filtered.map((cl) => {
              const open = openId === cl.client_id;
              const name = cl.client_name || c.unnamed;
              const suggestion = suggestedNext(cl, reminderWeeks);
              const repeatable = cl.bookings.find((b) => b.status === "accepted" || b.status === "completed");
              return (
                <li key={cl.client_id} className="rounded-lg border border-border/70">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left sm:p-4"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : cl.client_id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate flex items-center gap-2">
                        {name}
                        {cl.completed_count >= 2 ? <Badge variant="secondary" className="text-[10px]">{c.repeatClient}</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.bookings}: {cl.total_bookings} · {c.completed}: {cl.completed_count} · {c.paid}: {formatMoneyCents(cl.total_paid_cents, lang)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.lastVisit}: {formatYmd(cl.last_visit, lang)}
                        {cl.next_visit ? ` · ${c.nextVisit}: ${formatYmd(cl.next_visit, lang)}` : suggestion ? ` · ${c.suggested}: ${formatYmd(suggestion, lang)}` : ""}
                      </p>
                    </div>
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {open ? (
                    <div className="space-y-4 border-t border-border/70 p-3 sm:p-4">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`crm-note-${cl.client_id}`}>{c.notes}</label>
                        <Textarea
                          id={`crm-note-${cl.client_id}`}
                          className="mt-1 text-sm"
                          rows={3}
                          maxLength={4000}
                          value={drafts[cl.client_id] ?? cl.note ?? ""}
                          placeholder={c.notesPlaceholder}
                          onChange={(e) => setDrafts((d) => ({ ...d, [cl.client_id]: e.target.value }))}
                        />
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          {repeatable ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => onSetupRepeat(repeatable)}>
                              <Repeat className="mr-1 size-4" aria-hidden /> {c.setupRepeat}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" disabled={savingId === cl.client_id} onClick={() => void saveNote(cl)}>
                            {savingId === cl.client_id ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                            {c.saveNote}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">{c.history}</p>
                        <ul className="divide-y divide-border/60 text-sm">
                          {cl.bookings.map((b) => (
                            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span className="min-w-0">
                                <span className="text-foreground">{formatYmd(b.date, lang)}</span>
                                {b.time ? <span className="text-muted-foreground"> · {String(b.time).slice(0, 5)}</span> : null}
                                {b.service_slug ? <span className="text-muted-foreground"> · {serviceSlugLabel(b.service_slug)}</span> : null}
                                {b.series_id ? <Repeat className="ml-1 inline size-3 text-muted-foreground" aria-label={GROWTH_COPY[lang].series.badge} /> : null}
                              </span>
                              <span className="flex items-center gap-2">
                                {b.paid_cents ? <span className="text-xs text-muted-foreground">{formatMoneyCents(b.paid_cents, lang)}</span> : null}
                                <Badge variant="outline" className="text-[10px]">{c.status[b.status] ?? b.status}</Badge>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

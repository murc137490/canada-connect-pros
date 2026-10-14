import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FileText, Loader2, Mail, Repeat, Users } from "lucide-react";
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
  reminder_enabled?: boolean;
  reminder_weeks?: number | null;
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
  const [savingReminderId, setSavingReminderId] = useState<string | null>(null);
  const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<Record<string, string>>({});
  const [otherRecipientOpen, setOtherRecipientOpen] = useState<Record<string, boolean>>({});

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

  const saveReminderPreference = async (cl: CrmClient, enabled: boolean, weeks: number | null) => {
    setSavingReminderId(cl.client_id);
    const { error } = await untypedDb.from("pro_client_reminder_preferences").upsert(
      { pro_profile_id: proProfileId, client_id: cl.client_id, enabled, weeks },
      { onConflict: "pro_profile_id,client_id" },
    );
    setSavingReminderId(null);
    if (error) {
      toast({ title: c.sendRemindersToClient, description: growthErrorMessage(error, lang), variant: "destructive" });
      return;
    }
    toast({ title: lang === "fr" ? "Préférence de rappel enregistrée" : "Reminder preference saved" });
    onChanged();
  };

  const openEmailDraft = (cl: CrmClient, booking: CrmBooking, recipient: string) => {
    const service = serviceSlugLabel(booking.service_slug) || "service";
    const subject = lang === "fr" ? `Suivi de votre réservation ${service}` : `Following up on your ${service} booking`;
    const body = lang === "fr"
      ? `Bonjour ${cl.client_name || c.unnamed},\n\nJe vous écris au sujet de notre réservation.\nService : ${service}\nDate : ${formatYmd(booking.date, lang)}${booking.time ? ` à ${String(booking.time).slice(0, 5)}` : ""}\nStatut : ${c.status[booking.status] ?? booking.status}${booking.paid_cents ? `\nMontant payé : ${formatMoneyCents(booking.paid_cents, lang)}` : ""}\nRéférence : ${booking.code ?? booking.id}\n\n`
      : `Hi ${cl.client_name || c.unnamed},\n\nI’m following up about our booking.\nService: ${service}\nDate: ${formatYmd(booking.date, lang)}${booking.time ? ` at ${String(booking.time).slice(0, 5)}` : ""}\nStatus: ${c.status[booking.status] ?? booking.status}${booking.paid_cents ? `\nAmount paid: ${formatMoneyCents(booking.paid_cents, lang)}` : ""}\nReference: ${booking.code ?? booking.id}\n\n`;
    window.location.assign(`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const emailClient = async (cl: CrmClient, booking: CrmBooking) => {
    setLoadingEmailId(booking.id);
    const { data, error } = await untypedDb.rpc("pro_get_paid_booking_client_email", { p_booking_id: booking.id });
    setLoadingEmailId(null);
    if (error || typeof data !== "string" || !data.includes("@")) {
      toast({
        title: c.emailClient,
        description: lang === "fr" ? "Courriel indisponible pour cette réservation." : "Email is unavailable for this booking.",
        variant: "destructive",
      });
      return;
    }
    openEmailDraft(cl, booking, data);
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="size-4" aria-hidden /> {c.title}
        </h3>
        {c.intro ? <p className="text-sm text-muted-foreground mt-1">{c.intro}</p> : null}
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
                      <div className="rounded-lg border border-border/70 p-3 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={cl.reminder_enabled !== false}
                            disabled={savingReminderId === cl.client_id}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => void saveReminderPreference(cl, e.target.checked, cl.reminder_weeks ?? null)}
                            className="size-4 accent-primary"
                          />
                          {c.sendRemindersToClient}
                          {savingReminderId === cl.client_id ? <Loader2 className="size-4 animate-spin" aria-label={lang === "fr" ? "Enregistrement" : "Saving"} /> : null}
                        </label>
                        <div className="grid gap-1.5 sm:max-w-sm">
                          <label htmlFor={`crm-reminder-weeks-${cl.client_id}`} className="text-xs text-muted-foreground">{c.reminderInterval}</label>
                          <select
                            id={`crm-reminder-weeks-${cl.client_id}`}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            value={cl.reminder_weeks == null ? "global" : String(cl.reminder_weeks)}
                            disabled={savingReminderId === cl.client_id || cl.reminder_enabled === false}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => void saveReminderPreference(cl, cl.reminder_enabled !== false, e.target.value === "global" ? null : Number(e.target.value))}
                          >
                            <option value="global">{c.sameInterval} ({reminderWeeks} {c.weeks})</option>
                            {[2, 4, 6, 8, 12, 26, 52].map((w) => <option key={w} value={w}>{w} {c.weeks}</option>)}
                          </select>
                        </div>
                      </div>
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
                                <Button asChild type="button" size="sm" variant="outline" className="h-8 gap-1.5">
                                  <Link to={`/dashboard?tab=invoices&bookingId=${encodeURIComponent(b.id)}`}>
                                    <FileText className="size-3.5" aria-hidden /> {c.invoice}
                                  </Link>
                                </Button>
                              </span>
                              <div className="flex w-full flex-wrap items-center justify-end gap-2 pt-1">
                                {b.paid_cents && ["accepted", "completed"].includes(b.status) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5"
                                    disabled={loadingEmailId === b.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void emailClient(cl, b);
                                    }}
                                  >
                                    {loadingEmailId === b.id ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" aria-hidden />}
                                    {c.emailClient}
                                  </Button>
                                ) : (
                                  <span className="mr-auto text-xs text-muted-foreground">{c.emailUnavailable}</span>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOtherRecipientOpen((state) => ({ ...state, [b.id]: !state[b.id] }));
                                  }}
                                >
                                  {otherRecipientOpen[b.id] ? c.cancelEmailAnother : c.emailAnother}
                                </Button>
                                {otherRecipientOpen[b.id] ? (
                                  <>
                                    <Input
                                      type="email"
                                      className="h-8 w-full sm:max-w-xs"
                                      aria-label={c.emailRecipient}
                                      placeholder={c.emailRecipient}
                                      value={emailRecipients[b.id] ?? ""}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setEmailRecipients((values) => ({ ...values, [b.id]: e.target.value }))}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 gap-1.5"
                                      disabled={!/^\S+@\S+\.\S+$/.test(emailRecipients[b.id] ?? "")}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEmailDraft(cl, b, emailRecipients[b.id].trim());
                                      }}
                                    >
                                      <Mail className="size-3.5" aria-hidden /> {c.emailDraft}
                                    </Button>
                                  </>
                                ) : null}
                              </div>
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

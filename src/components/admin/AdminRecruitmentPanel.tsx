import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, Link2, Mail, Pencil, Plus, Save, Trash2, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { safeHttpUrl } from "@/lib/safeUrl";

type Contact = { id: string; first_name: string; last_name: string | null; business_name: string | null; email: string | null; phone: string | null; website: string | null; locale: "fr" | "en"; notes: string | null; meeting_at: string | null; meeting_url: string | null; last_email_template: string | null; last_email_sent_at: string | null };
type Draft = { id: string; contact_id: string; template: "first_contact" | "post_call"; recipient_email: string; subject: string; body: string; status: "pending" | "sending" | "sent" | "rejected"; created_at: string };
type Reply = { id: string; contact_id: string | null; sender_email: string; subject: string; body_text: string; received_at: string };
type ZohoStatus = { connected: boolean; data_center?: string; mailbox_hint?: string; mailbox_verified?: boolean; connected_at?: string; granted_scopes?: string[] };
type Form = Omit<Contact, "id" | "last_email_template" | "last_email_sent_at"> & { id?: string };
const empty: Form = { first_name: "", last_name: "", business_name: "", email: "", phone: "", website: "", locale: "fr", notes: "", meeting_at: "", meeting_url: "" };
const localDateTime = (value: string | null) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const googleCalendarDraft = (form: Form) => { if (!form.meeting_at) return "https://calendar.google.com/calendar/u/0/r/eventedit"; const start = new Date(form.meeting_at); const end = new Date(start.getTime() + 15 * 60_000); const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); const details = [`Introduction to AltShift${form.business_name ? ` · ${form.business_name}` : ""}`, form.email ? `Email: ${form.email}` : "", form.phone ? `Phone: ${form.phone}` : "", form.website ?? "", form.meeting_url ? `Google Meet: ${form.meeting_url}` : ""].filter(Boolean).join("\n"); const params = new URLSearchParams({ action: "TEMPLATE", text: `AltShift · 15-minute introduction · ${form.first_name} ${form.last_name ?? ""}`.trim(), dates: `${stamp(start)}/${stamp(end)}`, details, ...(form.email ? { add: form.email } : {}) }); return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`; };

export default function AdminRecruitmentPanel() {
  const { locale } = useLanguage(); const fr = locale === "fr"; const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]); const [drafts, setDrafts] = useState<Draft[]>([]); const [replies, setReplies] = useState<Reply[]>([]); const [form, setForm] = useState<Form>(empty); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [zohoBusy, setZohoBusy] = useState(false); const [zohoStatus, setZohoStatus] = useState<ZohoStatus | null>(null);
  const scrolledDraft = useRef("");
  const copy = fr
    ? { title: "Recrutement", first: "Prénom", last: "Nom", business: "Entreprise", email: "Courriel", phone: "Téléphone", website: "Site Web", notes: "Notes", lang: "Langue du courriel", meeting: "Rencontre prévue", link: "Lien Google Meet (facultatif)", save: "Enregistrer le contact", new: "Nouveau contact", firstDraft: "Rédiger le premier courriel", followDraft: "Rédiger le suivi après appel", noContacts: "Aucun contact pour le moment.", sent: "Dernier courriel", draftReady: "Brouillon créé. Il attend votre approbation.", saved: "Contact enregistré", error: "Impossible de terminer l’opération.", pending: "Brouillons à approuver", approve: "Approuver et envoyer", reject: "Refuser", edit: "Objet et message modifiables", approved: "Courriel envoyé", noticeFailed: "Brouillon créé, mais l’avis par courriel n’a pas pu être envoyé.", noDrafts: "Aucun brouillon à approuver.", inbox: "Réponses reçues", noReplies: "Aucune réponse reçue.", zoho: "Zoho Mail", connectZoho: "Connecter Zoho Mail", reconnectZoho: "Reconnecter Zoho Mail", connectedZoho: "Connecté", zohoFailed: "La connexion Zoho n’a pas abouti. Vous pouvez réessayer.", zohoStarted: "Redirection vers Zoho…", zohoSetup: "Configurez d’abord ZOHO_CLIENT_ID et ZOHO_CLIENT_SECRET dans les secrets Supabase." }
    : { title: "Recruitment", first: "First name", last: "Last name", business: "Business", email: "Email", phone: "Phone", website: "Website", notes: "Notes", lang: "Email language", meeting: "Meeting time", link: "Google Meet link (optional)", save: "Save contact", new: "New contact", firstDraft: "Draft first-contact email", followDraft: "Draft post-call follow-up", noContacts: "No contacts yet.", sent: "Last email", draftReady: "Draft created. It is waiting for your approval.", saved: "Contact saved", error: "Could not complete the action.", pending: "Drafts awaiting approval", approve: "Approve and send", reject: "Reject", edit: "Editable subject and message", approved: "Email sent", noticeFailed: "Draft created, but the email notice could not be delivered.", noDrafts: "No drafts to review.", inbox: "Prospect replies", noReplies: "No replies received.", zoho: "Zoho Mail", connectZoho: "Connect Zoho Mail", reconnectZoho: "Reconnect Zoho Mail", connectedZoho: "Connected", zohoFailed: "Zoho authorization did not complete. You can try again.", zohoStarted: "Redirecting to Zoho…", zohoSetup: "First add ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET to Supabase Edge Function secrets." };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "list" } });
    setContacts(data?.contacts ?? []); setDrafts(data?.drafts ?? []); setReplies(data?.replies ?? []);
    if (error || data?.error) toast({ title: copy.error, description: data?.error ?? error?.message, variant: "destructive" });
    setLoading(false);
  }, [copy.error, toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    void supabase.functions.invoke("zoho-oauth-start", { body: { action: "status" } }).then(({ data }) => {
      if (active && data && typeof data.connected === "boolean") setZohoStatus(data as ZohoStatus);
    });
    const params = new URLSearchParams(window.location.search);
    const result = params.get("zoho");
    if (result) {
      if (result === "connected") toast({ title: copy.connectedZoho });
      else toast({ title: copy.zohoFailed, variant: "destructive" });
      params.delete("zoho");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    return () => { active = false; };
  }, [copy.connectedZoho, copy.zohoFailed, toast]);

  const connectZoho = async () => {
    setZohoBusy(true);
    const { data, error } = await supabase.functions.invoke("zoho-oauth-start", { body: { action: "start" } });
    setZohoBusy(false);
    if (error || !data?.authorize_url) {
      const description = data?.error === "Zoho OAuth credentials are not configured" ? copy.zohoSetup : data?.error;
      toast({ title: copy.zohoFailed, description, variant: "destructive" });
      return;
    }
    toast({ title: copy.zohoStarted });
    window.location.assign(data.authorize_url);
  };
  useEffect(() => {
    if (loading) return;
    const target = new URLSearchParams(window.location.search).get("draft");
    if (target && target !== scrolledDraft.current) {
      document.getElementById(`recruitment-draft-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledDraft.current = target;
    }
  }, [loading, drafts]);

  const save = async () => {
    setBusy(true); const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "save", ...form, meeting_at: form.meeting_at ? new Date(form.meeting_at).toISOString() : null } }); setBusy(false);
    if (error || data?.error) { toast({ title: copy.error, description: data?.error ?? error?.message, variant: "destructive" }); return; }
    toast({ title: copy.saved }); setForm(empty); await load();
  };
  const edit = (c: Contact) => setForm({ ...c, meeting_at: localDateTime(c.meeting_at) });
  const remove = async (id: string) => { if (!window.confirm(fr ? "Supprimer ce contact?" : "Delete this contact?")) return; const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "delete", id } }); if (error || data?.error) toast({ title: copy.error, variant: "destructive" }); else await load(); };
  const makeDraft = async (c: Contact, template: "first_contact" | "post_call") => {
    if (!c.email) { edit(c); return; }
    setBusy(true); const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "draft", id: c.id, template } }); setBusy(false);
    if (error || data?.error) { toast({ title: copy.error, description: data?.error ?? error?.message, variant: "destructive" }); return; }
    toast({ title: copy.draftReady, description: data?.approval_notice_sent === false ? copy.noticeFailed : undefined }); await load();
  };
  const editDraft = (id: string, key: "subject" | "body", value: string) => setDrafts((old) => old.map((d) => d.id === id ? { ...d, [key]: value } : d));
  const approveDraft = async (draft: Draft) => {
    setBusy(true);
    const { data: saved, error: saveError } = await supabase.functions.invoke("admin-recruitment", { body: { action: "update_draft", id: draft.id, subject: draft.subject, body: draft.body } });
    if (saveError || saved?.error) { setBusy(false); toast({ title: copy.error, description: saved?.error ?? saveError?.message, variant: "destructive" }); return; }
    const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "approve_draft", id: draft.id } }); setBusy(false);
    if (error || data?.error) { toast({ title: copy.error, description: data?.error ?? error?.message, variant: "destructive" }); return; }
    toast({ title: copy.approved }); await load();
  };
  const rejectDraft = async (id: string) => { setBusy(true); const { data, error } = await supabase.functions.invoke("admin-recruitment", { body: { action: "reject_draft", id } }); setBusy(false); if (error || data?.error) toast({ title: copy.error, description: data?.error ?? error?.message, variant: "destructive" }); else await load(); };
  const set = (key: keyof Form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const pendingDrafts = drafts.filter((draft) => draft.status === "pending");

  return <section className="mx-auto w-full max-w-6xl space-y-6 rounded-2xl border bg-card p-4 text-foreground sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><UserRoundPlus className="size-6" />{copy.title}</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={zohoBusy} onClick={() => void connectZoho()}><Link2 className="mr-2 size-4" />{zohoBusy ? copy.zohoStarted : zohoStatus?.connected ? copy.reconnectZoho : copy.connectZoho}</Button><Button variant="outline" onClick={() => setForm(empty)}><Plus className="mr-2 size-4" />{copy.new}</Button></div></header>
    {zohoStatus?.connected ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"><p className="font-medium text-emerald-700 dark:text-emerald-300">{copy.connectedZoho}</p></div> : null}
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{copy.inbox} ({replies.length})</h3>
      {replies.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noReplies}</p> : <div className="grid gap-3 md:grid-cols-2">{replies.map((reply) => {
        const contact = contacts.find((item) => item.id === reply.contact_id);
        return <article key={reply.id} className="min-w-0 space-y-2 rounded-xl border bg-background p-4">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-all font-medium">{contact ? `${contact.first_name} ${contact.last_name ?? ""}${contact.business_name ? ` · ${contact.business_name}` : ""}` : reply.sender_email}</p><p className="break-all text-xs text-muted-foreground">{reply.sender_email}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(reply.received_at).toLocaleString(fr ? "fr-CA" : "en-CA")}</time></div>
          {reply.subject ? <p className="font-medium">{reply.subject}</p> : null}<p className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-sm">{reply.body_text}</p>
        </article>;
      })}</div>}
    </section>
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{copy.pending} ({pendingDrafts.length})</h3>
      {pendingDrafts.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noDrafts}</p> : <div className="grid gap-3 md:grid-cols-2">{pendingDrafts.map((draft) => {
        const contact = contacts.find((item) => item.id === draft.contact_id);
        return <article id={`recruitment-draft-${draft.id}`} key={draft.id} className="min-w-0 space-y-3 rounded-xl border bg-background p-4">
          <div><p className="font-medium">{contact ? `${contact.first_name} ${contact.last_name ?? ""}${contact.business_name ? ` · ${contact.business_name}` : ""}` : draft.recipient_email}</p><p className="break-all text-xs text-muted-foreground">{draft.recipient_email}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(draft.created_at).toLocaleString(fr ? "fr-CA" : "en-CA")}</p></div>
          <div className="space-y-1"><Label htmlFor={`draft-subject-${draft.id}`}>{fr ? "Objet" : "Subject"}</Label><Input id={`draft-subject-${draft.id}`} value={draft.subject} onChange={(e) => editDraft(draft.id, "subject", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor={`draft-body-${draft.id}`}>{copy.edit}</Label><Textarea id={`draft-body-${draft.id}`} className="min-h-40" value={draft.body} onChange={(e) => editDraft(draft.id, "body", e.target.value)} /></div>
          <div className="flex flex-wrap gap-2"><Button disabled={busy || !draft.subject.trim() || !draft.body.trim()} onClick={() => void approveDraft(draft)}><Check className="mr-1.5 size-4" />{copy.approve}</Button><Button disabled={busy} variant="outline" onClick={() => void rejectDraft(draft.id)}><X className="mr-1.5 size-4" />{copy.reject}</Button></div>
        </article>;
      })}</div>}
    </section>

    <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
      {([ ["first_name",copy.first], ["last_name",copy.last], ["business_name",copy.business], ["email",copy.email], ["phone",copy.phone], ["website",copy.website] ] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`recruit-${key}`}>{label}</Label><Input id={`recruit-${key}`} value={form[key] ?? ""} onChange={(e) => set(key,e.target.value)} type={key === "email" ? "email" : key === "website" ? "url" : "text"} /></div>)}
      <div className="space-y-1"><Label htmlFor="recruit-locale">{copy.lang}</Label><select id="recruit-locale" className="h-10 w-full rounded-md border bg-background px-3" value={form.locale} onChange={(e) => set("locale",e.target.value)}><option value="fr">Français</option><option value="en">English</option></select></div>
      <div className="space-y-1"><Label htmlFor="recruit-meeting">{copy.meeting}</Label><Input id="recruit-meeting" type="datetime-local" value={form.meeting_at ?? ""} onChange={(e) => set("meeting_at",e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="recruit-meet-url">{copy.link}</Label><Input id="recruit-meet-url" type="url" value={form.meeting_url ?? ""} onChange={(e) => set("meeting_url",e.target.value)} placeholder="https://meet.google.com/..." /></div>
      <div className="space-y-1 sm:col-span-2 lg:col-span-3"><Label htmlFor="recruit-notes">{copy.notes}</Label><Textarea id="recruit-notes" value={form.notes ?? ""} onChange={(e) => set("notes",e.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3"><Button disabled={busy || !form.first_name.trim()} onClick={() => void save()}><Save className="mr-2 size-4" />{copy.save}</Button>{form.meeting_at ? <Button variant="outline" asChild><a href={googleCalendarDraft(form)} target="_blank" rel="noreferrer"><CalendarPlus className="mr-2 size-4" />{fr ? "Préparer dans Google Agenda" : "Prepare in Google Calendar"}</a></Button> : null}</div>
    </div>
    {loading ? <p className="text-sm text-muted-foreground">…</p> : contacts.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.noContacts}</p> : <div className="grid gap-3 md:grid-cols-2">{contacts.map((c) => <article key={c.id} className="min-w-0 rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-semibold">{c.first_name} {c.last_name} {c.business_name ? <span className="font-normal text-muted-foreground">· {c.business_name}</span> : null}</h3><p className="break-all text-sm text-muted-foreground">{c.email || c.phone || ""}</p>{c.website ? <a className="break-all text-sm text-primary underline" href={safeHttpUrl(c.website, { assumeHttps: true }) ?? undefined} target="_blank" rel="noreferrer">{c.website}</a> : null}{c.meeting_at ? <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarPlus className="size-3.5" />{new Date(c.meeting_at).toLocaleString(c.locale === "fr" ? "fr-CA" : "en-CA")}</p> : null}{c.last_email_sent_at ? <p className="mt-1 text-xs text-muted-foreground">{copy.sent}: {new Date(c.last_email_sent_at).toLocaleDateString()}</p> : null}</div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={copy.new} onClick={() => edit(c)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={fr ? "Supprimer" : "Delete"} onClick={() => void remove(c.id)}><Trash2 className="size-4" /></Button></div></div>{c.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{c.notes}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !c.email} onClick={() => void makeDraft(c,"first_contact")}><Mail className="mr-1.5 size-3.5" />{copy.firstDraft}</Button><Button size="sm" disabled={busy || !c.email} onClick={() => void makeDraft(c,"post_call")}><Mail className="mr-1.5 size-3.5" />{copy.followDraft}</Button></div></article>)}</div>}
    <p className="text-xs text-muted-foreground">{fr ? "Les courriels de recrutement sont envoyés par grok@altshift.com. Les réponses des contacts enregistrés apparaissent dans la boîte ci-dessus." : "Recruitment emails are sent from grok@altshift.com. Replies from saved contacts appear in the inbox above."}</p>
  </section>;
}

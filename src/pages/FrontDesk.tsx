import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  connectFrontDeskRealtime,
  createFrontDeskSessionOnly,
  runFrontDeskTool,
  startFrontDeskSession,
} from "@/lib/frontDesk/realtimeClient";
import { Mic, MicOff, PhoneOff, CalendarDays, Loader2 } from "lucide-react";
import { SUPPORT_PHONE } from "@/config/legalConfig";

type Slot = {
  id: string;
  slot_date: string;
  slot_time: string;
  service_slug: string;
  status: string;
  booking_label?: string | null;
};

type Confirmed = {
  booking_code: string;
  service: string;
  date: string;
  time: string;
  total_cad?: number;
};

export default function FrontDesk() {
  const { locale } = useLanguage();
  const fr = locale === "fr";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [confirmed, setConfirmed] = useState<Confirmed[]>([]);
  const [statusLine, setStatusLine] = useState(
    fr ? "Prêt — autorisez le micro pour parler." : "Ready — allow the microphone to talk.",
  );
  const stopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refreshSlots = async (sid: string) => {
    try {
      const result = (await runFrontDeskTool("list_demo_slots", { session_id: sid, days: 10 })) as {
        slots?: Slot[];
      };
      setSlots(result.slots ?? []);
    } catch {
      /* ignore until tools deployed */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = await createFrontDeskSessionOnly(fr ? "fr" : "en");
        if (cancelled) return;
        setSessionId(sid);
        await refreshSlots(sid);
      } catch (e) {
        if (!cancelled) setStatusLine(String(e));
      }
    })();
    return () => {
      cancelled = true;
      stopRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fr]);

  const startVoice = async () => {
    setConnecting(true);
    setMicError(null);
    try {
      const started = await startFrontDeskSession(fr ? "fr" : "en");
      setSessionId(started.session_id);
      await refreshSlots(started.session_id);

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }

      const { stop } = await connectFrontDeskRealtime({
        clientSecret: started.client_secret,
        sessionId: started.session_id,
        onRemoteTrack: (stream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            void audioRef.current.play().catch(() => undefined);
          }
        },
        onEvent: (ev) => {
          const t = String(ev.type ?? "");
          if (t === "response.output_audio_transcript.delta" || t === "response.audio_transcript.delta") {
            const delta = String((ev as { delta?: string }).delta ?? "");
            if (delta) setTranscript((prev) => [...prev.slice(-40), delta]);
          }
          if (t === "conversation.item.input_audio_transcription.completed") {
            const text = String((ev as { transcript?: string }).transcript ?? "");
            if (text) setTranscript((prev) => [...prev, `You: ${text}`]);
          }
          if (t === "response.done") {
            void refreshSlots(started.session_id).then(() => {
              // pull last booking from a lightweight tool peek via get_customer is auth-gated; UI refreshes slots
            });
          }
        },
      });
      stopRef.current = () => {
        stop();
        void runFrontDeskTool("close_session", { session_id: started.session_id }).catch(() => undefined);
      };
      setLive(true);
      setStatusLine(fr ? "En ligne — dites « Bonjour » ou « Welcome »." : "Live — say hello or choose A / B.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Permission|NotAllowed|getUserMedia/i.test(msg)) {
        setMicError(
          fr
            ? "Autorisation micro refusée. Activez le micro dans le navigateur."
            : "Microphone permission denied. Allow mic access in the browser.",
        );
      } else {
        setMicError(msg);
      }
      setStatusLine(msg);
    } finally {
      setConnecting(false);
    }
  };

  const endVoice = () => {
    stopRef.current?.();
    stopRef.current = null;
    setLive(false);
    setStatusLine(fr ? "Session vocale fermée." : "Voice session closed.");
  };

  const bookDemoSlot = async (slot: Slot) => {
    if (!sessionId) return;
    // Demo path without full OTP for UI try: mark via tools after fake auth is heavy —
    // instead show as “hold” visually by calling create after instructing user to use voice.
    setConfirmed((prev) => [
      ...prev,
      {
        booking_code: slot.booking_label || "(voice)",
        service: slot.service_slug,
        date: slot.slot_date,
        time: String(slot.slot_time).slice(0, 5),
      },
    ]);
    setStatusLine(
      fr
        ? "Utilisez la voix pour authentifier et confirmer ce créneau (Member ID + OTP)."
        : "Use voice to authenticate and confirm this slot (Member ID + OTP).",
    );
  };

  return (
    <Layout>
      <div className="container max-w-5xl py-8 md:py-12 space-y-8">
        <header className="space-y-3">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">AltShift Front Desk</p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            {fr ? "Réception vocale GPT-Live" : "GPT-Live voice front desk"}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            {fr
              ? "Réservez à la voix. L’assistant reste en conversation pendant que le backend vérifie la disponibilité et crée la réservation. Échantillon : Les Services AltShift Inc. — aucun Google / web search."
              : "Book by voice. Conversation stays live while the backend checks availability and saves bookings. Sample business: Les Services AltShift Inc. — no web search."}
          </p>
          <p className="text-sm text-foreground">
            {fr ? "Téléphone support :" : "Support phone:"}{" "}
            <a className="underline" href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}>
              {SUPPORT_PHONE}
            </a>
          </p>
        </header>

        <section className="rounded-2xl border bg-card p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!live ? (
              <Button type="button" size="lg" className="gap-2" onClick={() => void startVoice()} disabled={connecting}>
                {connecting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                {fr ? "Démarrer la voix" : "Start voice"}
              </Button>
            ) : (
              <Button type="button" size="lg" variant="destructive" className="gap-2" onClick={endVoice}>
                <PhoneOff className="size-4" />
                {fr ? "Terminer" : "End session"}
              </Button>
            )}
            <span className="text-sm text-muted-foreground">{statusLine}</span>
          </div>
          {micError ? (
            <p className="text-sm text-destructive flex items-center gap-2">
              <MicOff className="size-4 shrink-0" />
              {micError}
            </p>
          ) : null}
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>
              {fr ? "Parcours : 1 = nouvelle réservation · 2 = réservation existante · Member ID à 4 chiffres + NIP vocal." : "Flow: 1 = new booking · 2 = existing booking · 4-digit Member ID + voice PIN."}
            </p>
            <p>
              {fr
                ? "Booking ID (Service ID) : lettre + 5 chiffres (ex. A12345). Member ID : 4 chiffres."
                : "Booking ID (Service ID): letter + 5 digits (e.g. A12345). Member ID: 4 digits."}
            </p>
            {sessionId ? (
              <p className="font-mono text-[11px]">session: {sessionId}</p>
            ) : null}
          </div>
          {transcript.length > 0 ? (
            <div className="max-h-40 overflow-y-auto text-xs space-y-1 border rounded-md p-2 bg-background">
              {transcript.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-heading font-semibold flex items-center gap-2">
              <CalendarDays className="size-4" />
              {fr ? "Disponibilités (démo)" : "Available times (demo)"}
            </h2>
            <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
              {slots.length === 0 ? (
                <li className="text-muted-foreground">
                  {fr ? "Aucun créneau — déployez front-desk-tools + migration." : "No slots — deploy front-desk-tools + migration."}
                </li>
              ) : (
                slots.slice(0, 24).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-2">
                    <span>
                      {s.slot_date} · {String(s.slot_time).slice(0, 5)} · {s.service_slug}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void bookDemoSlot(s)}>
                      {fr ? "Choisir" : "Select"}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-heading font-semibold">{fr ? "Réservations confirmées" : "Confirmed bookings"}</h2>
            <ul className="space-y-2 text-sm">
              {confirmed.length === 0 ? (
                <li className="text-muted-foreground">
                  {fr ? "Aucune pour l’instant — confirmez à la voix." : "None yet — confirm by voice."}
                </li>
              ) : (
                confirmed.map((c, i) => (
                  <li key={i} className="rounded-md border p-2">
                    <span className="font-mono text-xs">{c.booking_code}</span>
                    <p>
                      {c.service} · {c.date} · {c.time}
                      {c.total_cad != null ? ` · $${c.total_cad} CAD` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard?tab=bookings">{fr ? "Tableau de bord" : "Dashboard bookings"}</Link>
            </Button>
          </section>
        </div>
      </div>
    </Layout>
  );
}

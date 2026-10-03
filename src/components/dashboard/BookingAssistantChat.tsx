import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { id?: string; role: "user" | "assistant"; content: string; sender_role?: string };

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-hf`;

type Props = {
  enabled: boolean;
  bookingId: string;
  /** When set, loads this pro's profile + services so answers stay about THIS professional only. */
  proProfileId?: string | null;
  locale: "en" | "fr";
  viewerRole: "client" | "pro";
  businessName: string;
  appointmentSummary: string;
  serviceLabel?: string | null;
};

/**
 * Post-booking Q&A scoped to ONE professional's account data (services, bio, policies).
 * Pro-tier only. Uses Gemini via ai-chat-hf (HF fallback). No general / off-platform answers.
 */
export default function BookingAssistantChat({
  enabled,
  bookingId,
  proProfileId,
  locale,
  viewerRole,
  businessName,
  appointmentSummary,
  serviceLabel,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proContext, setProContext] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const copy =
    locale === "fr"
      ? {
          title: `Assistant — ${businessName}`,
          intro: `Bonjour! Je réponds uniquement aux questions sur ${businessName}, ses services et votre rendez-vous. Posez une question (préparation, durée, ce qui est inclus, etc.).`,
          placeholder: "Ex. : Que dois-je préparer avant votre visite?",
          thinking: "Réflexion…",
          signIn: "Connectez-vous pour utiliser l’assistant.",
          noReply: "Aucune réponse. Réessayez ou contactez le pro / le support.",
          errorGeneric: "Erreur de l’assistant",
        }
      : {
          title: `Assistant — ${businessName}`,
          intro: `Hi! I only answer questions about ${businessName}, their services, and your appointment. Ask about prep, timing, what’s included, etc.`,
          placeholder: "e.g. What should I prepare before the visit?",
          thinking: "Thinking…",
          signIn: "Sign in to use the assistant.",
          noReply: "No reply. Try again or contact the pro / support.",
          errorGeneric: "Assistant error",
        };

  useEffect(() => {
    if (!enabled || !proProfileId) {
      setProContext("");
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: pro }, { data: services }] = await Promise.all([
        supabase
          .from("pro_profiles")
          .select(
            "business_name, bio, service_tags, years_experience, primary_category_slug, booking_cancel_policy, booking_cancel_fee_percent, service_at_workspace_only, offers_workspace, offers_travel, business_address, service_radius_km, price_min, price_max, pro_member_id",
          )
          .eq("id", proProfileId)
          .maybeSingle(),
        supabase
          .from("pro_services")
          .select("service_slug, category_slug, display_name, description, custom_price_min, custom_price_max, duration_minutes, location_mode")
          .eq("pro_profile_id", proProfileId)
          .limit(40),
      ]);
      if (cancelled) return;
      const p = pro as Record<string, unknown> | null;
      const svcLines = ((services as Record<string, unknown>[] | null) ?? [])
        .map((s) => {
          const name = String(s.display_name || s.service_slug || "");
          const price =
            s.custom_price_min != null || s.custom_price_max != null
              ? ` price$${s.custom_price_min ?? "?"}-${s.custom_price_max ?? "?"}`
              : "";
          const dur = s.duration_minutes != null ? ` ${s.duration_minutes}min` : "";
          const desc = s.description ? ` — ${String(s.description).slice(0, 180)}` : "";
          return `- ${name}${price}${dur}${desc}`;
        })
        .join("\n");
      const block = [
        `Pro business: ${p?.business_name ?? businessName}`,
        p?.pro_member_id ? `Pro Member ID (4-digit): ${p.pro_member_id}` : null,
        p?.bio ? `Bio: ${String(p.bio).slice(0, 500)}` : null,
        p?.years_experience != null ? `Years experience: ${p.years_experience}` : null,
        p?.primary_category_slug ? `Main category: ${p.primary_category_slug}` : null,
        Array.isArray(p?.service_tags) ? `Tags: ${(p!.service_tags as string[]).join(", ")}` : null,
        p?.booking_cancel_policy ? `Cancel policy: ${p.booking_cancel_policy}` : null,
        p?.booking_cancel_fee_percent != null ? `Cancel fee %: ${p.booking_cancel_fee_percent}` : null,
        p?.service_at_workspace_only ? "Clients visit workspace" : null,
        p?.offers_travel ? "Pro travels to clients" : null,
        p?.business_address ? `Workspace address: ${p.business_address}` : null,
        p?.service_radius_km != null ? `Service radius km: ${p.service_radius_km}` : null,
        p?.price_min != null || p?.price_max != null ? `Listed price range: $${p?.price_min ?? "?"}-$${p?.price_max ?? "?"}` : null,
        svcLines ? `Services offered:\n${svcLines}` : "Services: (none listed — stick to booking summary only)",
      ]
        .filter(Boolean)
        .join("\n");
      setProContext(block);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, proProfileId, businessName]);

  useEffect(() => {
    if (!enabled || !bookingId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("booking_assistant_messages")
        .select("id, sender_role, content, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true })
        .limit(80);
      if (cancelled) return;
      const rows = (data ?? []) as { id: string; sender_role: string; content: string }[];
      if (rows.length === 0) {
        setMessages([{ role: "assistant", content: copy.intro }]);
        return;
      }
      setMessages(
        rows.map((r) => ({
          id: r.id,
          role: r.sender_role === "assistant" ? "assistant" : "user",
          content: r.content,
          sender_role: r.sender_role,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, bookingId, copy.intro]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const persist = async (sender_role: "client" | "pro" | "assistant", content: string, userId: string | null) => {
    await (supabase as any).from("booking_assistant_messages").insert({
      booking_id: bookingId,
      sender_role,
      sender_user_id: sender_role === "assistant" ? null : userId,
      content,
    });
  };

  const send = async () => {
    if (!enabled || !input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const next = [...messages, { role: "user" as const, content: userMsg, sender_role: viewerRole }];
    setMessages(next);
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMessages((prev) => [...prev, { role: "assistant", content: copy.signIn }]);
        setLoading(false);
        return;
      }

      await persist(viewerRole, userMsg, session.user.id);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Missing app configuration." }]);
        setLoading(false);
        return;
      }

      const recent = next.slice(-8);
      const contextMessage = recent
        .map((m) => {
          const who = m.sender_role === "pro" ? "Pro" : m.role === "user" ? "Client" : "Assistant";
          return `${who}: ${m.content}`;
        })
        .join("\n");

      const bookingBlock = [
        `Appointment: ${appointmentSummary || "n/a"}`,
        serviceLabel ? `Booked service label: ${serviceLabel}` : null,
        `Viewer: ${viewerRole}`,
      ]
        .filter(Boolean)
        .join("\n");

      const system_extension =
        locale === "fr"
          ? `Tu es l’assistant DÉDIÉ à CE professionnel AltShift uniquement (réservation déjà créée, forfait Pro).\nTu ne réponds QU’avec les infos du compte pro + la réservation. Pas de météo, pas de conseils généraux hors services, pas d’autres pros.\n\nPROFIL PRO:\n${proContext || businessName}\n\nRÉSERVATION:\n${bookingBlock}\n\nRéponds en français, concis. Si la question sort du périmètre, dis que tu ne peux aider que pour ce professionnel et ses services, et oriente vers le support AltShift (+1 450 800 3177 / support@altshift.ca).`
          : `You are the dedicated assistant for THIS AltShift professional only (existing booking, Pro tier).\nAnswer ONLY using this pro’s account info + this booking. No weather, no general off-topic advice, no other pros.\n\nPRO PROFILE:\n${proContext || businessName}\n\nBOOKING:\n${bookingBlock}\n\nReply in English, concise. If asked outside scope, say you can only help about this professional and their services, and point to AltShift support (+1 450 800 3177 / support@altshift.ca).`;

      const resp = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          message: contextMessage,
          access_token: session.access_token,
          language: locale === "fr" ? "fr" : "en",
          system_extension,
          intent: "booking_assistant",
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as { message?: string; error?: string; details?: string };
      if (!resp.ok) {
        const errMsg = data.details || data.error || `Request failed (${resp.status})`;
        setMessages((prev) => [...prev, { role: "assistant", content: `${copy.errorGeneric}: ${errMsg}` }]);
        setLoading(false);
        return;
      }

      const reply = (data.message ?? "").trim() || copy.noReply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      await persist("assistant", reply, null);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: copy.errorGeneric }]);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 mt-2 flex flex-col gap-2 max-h-[300px]">
      <p className="text-xs font-semibold text-foreground">{copy.title}</p>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 text-xs min-h-[72px] max-h-[160px] pr-1">
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`rounded-md px-2 py-1.5 ${
              m.role === "user" ? "bg-primary/15 text-foreground ml-6" : "bg-background border border-border/60 text-foreground/95 mr-6"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>{copy.thinking}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={copy.placeholder}
          className="flex-1 rounded-md border border-input bg-background text-foreground text-xs px-2 py-2 min-w-0"
          disabled={loading}
        />
        <Button type="button" size="sm" variant="secondary" className="shrink-0 h-9 px-2" onClick={() => void send()} disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

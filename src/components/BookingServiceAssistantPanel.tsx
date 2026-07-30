import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-hf`;

export default function BookingServiceAssistantPanel({
  enabled,
  locale,
  proBusinessName,
  serviceName,
  serviceDescription,
  appointmentSummary,
  messages: introMessages,
}: {
  enabled: boolean;
  locale: "en" | "fr";
  proBusinessName: string;
  serviceName: string;
  serviceDescription: string | null;
  appointmentSummary: string;
  messages: {
    title: string;
    intro: string;
    placeholder: string;
    thinking: string;
    signIn: string;
    noReply: string;
    errorGeneric: string;
  };
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: introMessages.intro }]);
  }, [introMessages.intro]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!enabled || !input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const next = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(next);
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMessages((prev) => [...prev, { role: "assistant", content: introMessages.signIn }]);
        setLoading(false);
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Missing app configuration." }]);
        setLoading(false);
        return;
      }

      const recent = next.slice(-6);
      const contextMessage = recent
        .map((m) => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`))
        .join("\n");

      const serviceBlock = [
        `Professional / business: ${proBusinessName}`,
        `Service: ${serviceName}`,
        serviceDescription ? `Service details: ${serviceDescription}` : null,
        appointmentSummary ? `Appointment: ${appointmentSummary}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const system_extension =
        locale === "fr"
          ? `Le client réserve ou envisage une réservation sur Premiere Services (Canada). Utilise ce contexte pour répondre avec précision:\n${serviceBlock}\nRéponds en français. Reste concis et utile; si tu ne sais pas, indique de contacter le professionnel ou le support Premiere.`
          : `The client is booking or considering a booking on Premiere Services (Canada). Use this context:\n${serviceBlock}\nReply in English. Be concise and helpful; if unsure, suggest contacting the professional or Premiere support.`;

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
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as { message?: string; error?: string; details?: string };
      if (!resp.ok) {
        const errMsg = data.details || data.error || `Request failed (${resp.status})`;
        setMessages((prev) => [...prev, { role: "assistant", content: `${introMessages.errorGeneric}: ${errMsg}` }]);
        setLoading(false);
        return;
      }

      const reply = (data.message ?? "").trim();
      setMessages((prev) => [...prev, { role: "assistant", content: reply || introMessages.noReply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: introMessages.errorGeneric }]);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="rounded-xl border border-white/20 bg-gray-950/80 p-3 mt-4 flex flex-col gap-2 max-h-[280px]">
      <p className="text-xs font-semibold text-white">{introMessages.title}</p>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 text-xs min-h-[80px] max-h-[140px] pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-2 py-1.5 ${m.role === "user" ? "bg-white/15 text-white ml-4" : "bg-black/30 text-white/95 mr-4"}`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-white/70 text-xs">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>{introMessages.thinking}</span>
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
          placeholder={introMessages.placeholder}
          className="flex-1 rounded-md bg-gray-800 border border-gray-600 text-white text-xs px-2 py-2 min-w-0"
          disabled={loading}
        />
        <Button type="button" size="sm" variant="secondary" className="shrink-0 h-9 px-2" onClick={() => void send()} disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Send, Bot, HelpCircle, BookOpen, Phone, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import GradientText from "@/components/GradientText";
import TextType from "@/components/TextType";
import BlurText from "@/components/BlurText";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-hf`;

export default function Support() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const prefillPrompt = searchParams.get("prompt");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const initialMessage = t.support.aiGreeting;
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 0
        ? [{ role: "assistant", content: initialMessage }]
        : prev[0]?.role === "assistant"
          ? [{ ...prev[0], content: initialMessage }, ...prev.slice(1) ]
          : prev
    );
  }, [initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillPrompt && !input.trim()) {
      setInput(prefillPrompt);
    }
  }, [prefillPrompt, input]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: t.support.signInToUse },
        ]);
        setLoading(false);
        return;
      }

      // User's preferred language for emails = same for AI replies (fr or en)
      let aiLanguage: "fr" | "en" = "en";
      if (user?.id) {
        const { data: profile } = await supabase.from("profiles").select("email_language").eq("user_id", user.id).single();
        const lang = (profile as { email_language?: string } | null)?.email_language;
        if (lang === "fr") aiLanguage = "fr";
      }

      // Build context from last few messages so the model can follow the conversation
      const recent = updatedMessages.slice(-6);
      const contextMessage = recent
        .map((m) => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`))
        .join("\n");

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        setMessages((prev) => [...prev, { role: "assistant", content: "App misconfiguration: VITE_SUPABASE_ANON_KEY is missing." }]);
        setLoading(false);
        return;
      }
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
          language: aiLanguage,
        }),
      });

      const data = await resp.json().catch(() => ({})) as { message?: string; error?: string; details?: string };
      const reply = data.message;
      const errMsg = data.error;
      const details = data.details;

      if (!resp.ok) {
        const displayMsg = details
          ? `${errMsg || "Error"}: ${details}`
          : errMsg
            ? `The assistant couldn't respond: ${errMsg}`
            : `Request failed (${resp.status}). Check that HUGGINGFACE_API_KEY is set in Supabase Edge Function secrets.`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: displayMsg },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: (reply && reply.trim()) || t.support.noReply },
      ]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t.support.errorGeneric,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-14 bg-gradient-page">
        <div className="container py-8 md:py-16 px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16 space-y-2">
            <GradientText
              colors={["#007A56", "#2C698C", "#EABB1F"]}
              animationSpeed={10}
              className="inline-block"
            >
              <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold">
                {t.support.title}
              </h1>
            </GradientText>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              {t.support.subtitle}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 md:gap-10 max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <div className="glass-card w-12 h-12 rounded-2xl flex items-center justify-center shrink-0">
                  <HelpCircle size={24} className="text-secondary" />
                </div>
                <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">
                  {t.support.faqTitle}
                </h2>
              </div>

              <div className="space-y-3">
                {[
                  { q: t.support.faq1q, a: t.support.faq1a },
                  { q: t.support.faq2q, a: t.support.faq2a },
                  { q: t.support.faq3q, a: t.support.faq3a },
                  { q: t.support.faq4q, a: t.support.faq4a },
                  { q: t.support.faq5q, a: t.support.faq5a },
                ].map((faq, i) => (
                  <div key={`${locale}-${i}`} className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-white/20 dark:hover:bg-gray-800/20 transition-colors"
                      aria-expanded={openFaq === i}
                      aria-label={openFaq === i ? "Close" : "See more"}
                    >
                      <span className="font-semibold text-foreground pr-4 min-h-[1.5em] flex items-center">
                        <TextType
                          text={faq.q}
                          as="span"
                          typingSpeed={28}
                          initialDelay={i * 180}
                          pauseDuration={999999}
                          loop={false}
                          showCursor={false}
                          startOnVisible
                          className="inline"
                        />
                      </span>
                      <Plus
                        size={20}
                        className={`text-muted-foreground shrink-0 transition-transform duration-500 ease-in-out ${openFaq === i ? "rotate-45" : ""}`}
                      />
                    </button>
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={{ gridTemplateRows: openFaq === i ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-5 pt-2">
                          {openFaq === i && (
                            <BlurText
                            text={faq.a}
                            animateBy="words"
                            direction="top"
                            delay={30}
                            stepDuration={0.25}
                            className="text-muted-foreground leading-relaxed"
                          />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-6 md:mt-8">
                <a href="tel:+15017990735" className="glass-card glass-hover rounded-xl p-3 md:p-4 space-y-1 min-w-0 block hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-secondary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground text-sm">{t.support.callUs}</h3>
                  <p className="text-xs text-muted-foreground">+1 501 799 0735</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{t.support.contactHours}</p>
                </a>
                <div className="glass-card glass-hover rounded-xl p-3 md:p-4 space-y-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="text-secondary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground text-sm">{t.support.email}</h3>
                  <p className="text-[11px] text-muted-foreground break-all min-w-0 select-text cursor-text" title="Select to copy">premiereservicescontact@gmail.com</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{t.support.contactResponse}</p>
                  <a href="mailto:premiereservicescontact@gmail.com?subject=Premiere%20Services%20-%20Support" className="inline-block mt-2 text-xs font-medium text-primary hover:underline focus:outline-none dark:text-sky-400 dark:hover:text-sky-300">
                    Send email →
                  </a>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden sticky top-24 h-fit">
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-4 md:p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Bot size={20} className="text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold truncate">{t.support.aiAssistant}</h3>
                  <p className="text-xs opacity-70">{t.support.poweredBy}</p>
                </div>
              </div>

              <div ref={scrollRef} className="h-96 overflow-y-auto p-5 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <Bot size={16} className="text-secondary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                      <Bot size={16} className="text-secondary" />
                    </div>
                    <div className="content-panel px-4 py-3 rounded-2xl text-foreground flex items-center gap-2 min-w-[140px]">
                      <Loader2 size={18} className="animate-spin text-secondary shrink-0" />
                      <span>{t.support.aiThinking}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 dark:border-gray-700/20 p-4 flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={t.support.askPlaceholder}
                  className="flex-1 glass-card rounded-2xl px-4 py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  size="sm"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-auto px-4"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

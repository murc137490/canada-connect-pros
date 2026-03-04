import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { Send, Bot, HelpCircle, BookOpen, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const faqs = [
  {
    q: "How do I hire a service professional?",
    a: "Simply search for the service you need, browse matching pros, compare quotes and reviews, then hire the one that fits your budget and timeline.",
  },
  {
    q: "How much does it cost to use Premiere Services?",
    a: "It's completely free for customers to search, get quotes, and hire professionals. Pros pay a small fee to connect with leads.",
  },
  {
    q: "Are the professionals verified?",
    a: "Yes, all pros go through a verification process including identity checks and license verification where applicable.",
  },
  {
    q: "What if I'm not happy with the service?",
    a: "We have a satisfaction guarantee. Contact our support team and we'll help resolve any issues with your service.",
  },
  {
    q: "Do you serve all provinces and territories?",
    a: "We're actively expanding across Canada. We currently have strong coverage in Ontario, BC, Alberta, and Quebec, with growing presence in other provinces.",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function Support() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi, I'm the Premiere Services AI assistant. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    let assistantSoFar = "";

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Please sign in to use the AI assistant.",
          },
        ]);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: resp.statusText }));
        const errMsg = (errBody as { error?: string })?.error ?? `Request failed (${resp.status})`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `The AI assistant couldn't respond: ${errMsg}. Make sure the "chat" Edge Function is deployed in Supabase and OPENAI_API_KEY is set.` },
        ]);
        return;
      }
      if (!resp.body) {
        setMessages((prev) => [...prev, { role: "assistant", content: "The AI assistant returned an empty response." }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user" && prev[prev.length - 2]?.content === userMsg.content) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again or contact us at support@premiereservices.ca.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-14">
        <div className="container py-16">
          <div className="text-center mb-16">
            <h1 className="font-heading text-5xl md:text-6xl font-extrabold text-foreground mb-4">
              Support
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get help from our AI assistant or browse common questions
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-8">
                <div className="glass-card w-12 h-12 rounded-2xl flex items-center justify-center">
                  <HelpCircle size={24} className="text-secondary" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-white/20 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                      <ChevronDown
                        size={20}
                        className={`text-muted-foreground shrink-0 transition-transform ${
                          openFaq === i ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {openFaq === i && (
                      <div className="px-5 pb-5 pt-2">
                        <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-10">
                <div className="glass-card glass-hover rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                    <Phone size={20} className="text-secondary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-2">Call Us</h3>
                  <p className="text-sm text-muted-foreground mb-1">1-800-PREMIERE</p>
                  <p className="text-xs text-muted-foreground">Mon-Fri, 8am-8pm EST</p>
                </div>
                <div className="glass-card glass-hover rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                    <BookOpen size={20} className="text-secondary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-2">Email</h3>
                  <p className="text-sm text-muted-foreground mb-1">support@premiereservices.ca</p>
                  <p className="text-xs text-muted-foreground">Response within 24 hours</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden sticky top-24 h-fit">
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Bot size={20} className="text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-heading font-bold">AI Support Assistant</h3>
                  <p className="text-xs opacity-70">Powered by ChatGPT</p>
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
                {loading && !messages[messages.length - 1]?.content && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                      <Bot size={16} className="text-secondary" />
                    </div>
                    <div className="bg-muted/50 px-4 py-3 rounded-2xl text-muted-foreground">
                      Thinking...
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
                  placeholder="Ask a question..."
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

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, HelpCircle, SquarePen, X, ArrowUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { sendSupportChatMessage, type SupportChatMessage } from "@/lib/supportChatApi";
import { MOTION } from "@/motion/types";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { ChatMessageContent } from "@/components/ChatMessageContent";

const HISTORY_KEY = "premiere-support-chat-history";
const ACTIVE_KEY = "premiere-support-chat-active";
const MAX_HISTORY = 20;

type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: SupportChatMessage[];
};

function loadHistory(): ChatThread[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(threads: ChatThread[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(threads.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function titleFromMessages(messages: SupportChatMessage[], fallback: string) {
  const firstUser = messages.find((m) => m.role === "user")?.content?.trim();
  if (!firstUser) return fallback;
  return firstUser.length > 42 ? `${firstUser.slice(0, 42)}…` : firstUser;
}

function TypingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-foreground/80", className)} aria-hidden>
      <span className="support-typing-dot" />
      <span className="support-typing-dot" />
      <span className="support-typing-dot" />
    </div>
  );
}

export default function HelpFab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = usePrefersReducedMotion();
  const panelId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greeting = t.support.aiGreeting;

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatThread[]>(() => loadHistory());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [messages, setMessages] = useState<SupportChatMessage[]>(() => {
    const threads = loadHistory();
    const id = loadActiveId();
    const found = id ? threads.find((th) => th.id === id) : undefined;
    return found?.messages?.length ? found.messages : [{ role: "assistant", content: greeting }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages((prev) => {
      const hasUser = prev.some((m) => m.role === "user");
      if (hasUser) return prev;
      if (prev.length === 1 && prev[0]?.role === "assistant") {
        return [{ role: "assistant", content: greeting }];
      }
      return prev;
    });
  }, [greeting]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) {
      const tmr = window.setTimeout(() => inputRef.current?.focus(), 280);
      return () => window.clearTimeout(tmr);
    }
  }, [open]);

  const persistThread = useCallback(
    (nextMessages: SupportChatMessage[], threadId: string | null) => {
      const hasUser = nextMessages.some((m) => m.role === "user");
      if (!hasUser) {
        setActiveId(null);
        saveActiveId(null);
        return;
      }
      const id = threadId ?? newId();
      const thread: ChatThread = {
        id,
        title: titleFromMessages(nextMessages, t.common.helpChatUntitled),
        updatedAt: Date.now(),
        messages: nextMessages,
      };
      setHistory((prev) => {
        const rest = prev.filter((th) => th.id !== id);
        const next = [thread, ...rest].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
      setActiveId(id);
      saveActiveId(id);
    },
    [t.common.helpChatUntitled]
  );

  const startNewChat = () => {
    setMessages([{ role: "assistant", content: greeting }]);
    setActiveId(null);
    saveActiveId(null);
    setInput("");
    setHistoryOpen(false);
    setLoading(false);
  };

  const loadThread = (thread: ChatThread) => {
    setMessages(thread.messages);
    setActiveId(thread.id);
    saveActiveId(thread.id);
    setHistoryOpen(false);
    setInput("");
  };

  const sendMessage = async () => {
    const raw = input.trim();
    if (!raw || loading) return;

    const prior = messages;
    const userMsg: SupportChatMessage = { role: "user", content: raw };
    const withUser = [...prior, userMsg];
    setMessages(withUser);
    setInput("");
    setLoading(true);
    setHistoryOpen(false);

    const result = await sendSupportChatMessage(raw, prior, {
      signIn: t.support.signInToUse,
      noReply: t.support.noReply,
      errorGeneric: t.support.errorGeneric,
    });

    const next = [...withUser, { role: "assistant" as const, content: result.reply }];
    setMessages(next);
    persistThread(next, activeId);
    setLoading(false);
  };

  const fabPos =
    "fixed z-[60] bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))]";
  const panelPos =
    "fixed z-[60] bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]";

  const panelTransition = reduced
    ? { duration: 0 }
    : { duration: 0.34, ease: MOTION.ease };
  const fabTransition = reduced
    ? { duration: 0 }
    : { duration: 0.28, ease: MOTION.ease };

  return (
    <div className="contents">
      <AnimatePresence mode="popLayout" initial={false}>
        {!open && (
          <motion.button
            key="help-fab"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.common.helpFabLabel}
            aria-expanded={false}
            aria-controls={panelId}
            className={cn(
              fabPos,
              "flex h-14 w-14 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground shadow-lg shadow-black/30",
              "border border-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
            initial={reduced ? false : { opacity: 0, scale: 0.72, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.75, y: 10 }}
            transition={fabTransition}
            whileHover={reduced ? undefined : { scale: 1.06 }}
            whileTap={reduced ? undefined : { scale: 0.94 }}
          >
            <HelpCircle className="h-6 w-6" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence
        onExitComplete={() => {
          /* keep history closed after panel leaves */
        }}
      >
        {open && (
          <motion.div
            key="help-panel"
            id={panelId}
            role="dialog"
            aria-label={t.support.title}
            className={cn(
              panelPos,
              "flex flex-col overflow-hidden support-glass",
              "w-[min(100vw-1.5rem,380px)] h-[min(72vh,560px)] rounded-[28px] origin-bottom-right"
            )}
            initial={reduced ? false : { opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            transition={panelTransition}
          >
            <div className="relative flex items-center justify-between gap-2 px-4 pt-3.5 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[15px] font-semibold text-foreground hover:bg-foreground/5 transition-colors"
                aria-expanded={historyOpen}
                aria-label={t.common.helpChatHistory}
              >
                {t.support.title}
                <ChevronDown
                  className={cn("h-4 w-4 opacity-70 transition-transform duration-200", historyOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] text-foreground hover:bg-foreground/10 transition-colors"
                  aria-label={t.common.helpNewChat}
                  title={t.common.helpNewChat}
                >
                  <SquarePen className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryOpen(false);
                    setOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] text-foreground hover:bg-foreground/10 transition-colors"
                  aria-label={t.common.helpCloseChat}
                  title={t.common.helpCloseChat}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <AnimatePresence>
                {historyOpen && (
                  <motion.div
                    key="help-history"
                    initial={reduced ? false : { opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: reduced ? 0 : 0.2, ease: MOTION.ease }}
                    className="absolute left-3 right-3 top-14 z-10 rounded-2xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-xl overflow-hidden origin-top"
                  >
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t.common.helpChatHistory}
                    </p>
                    <div className="max-h-48 overflow-y-auto py-1">
                      {history.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{t.common.helpNoHistory}</p>
                      ) : (
                        history.map((thread) => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => loadThread(thread)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 text-sm hover:bg-foreground/5 transition-colors",
                              thread.id === activeId && "bg-foreground/[0.06]"
                            )}
                          >
                            <span className="block truncate font-medium text-foreground">{thread.title}</span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                              {new Date(thread.updatedAt).toLocaleString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0"
              onClick={() => historyOpen && setHistoryOpen(false)}
            >
              {!user && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.support.signInToUse}{" "}
                  <Link
                    to="/auth"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    {t.nav.logIn}
                  </Link>
                </p>
              )}
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-foreground/[0.12] dark:bg-white/10 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="max-w-[95%] text-[14px] leading-relaxed text-foreground">
                    <ChatMessageContent text={msg.content} onNavigate={() => setOpen(false)} />
                  </div>
                )
              )}
              {loading && (
                <div className="pt-1" aria-live="polite" aria-label={t.support.aiThinking}>
                  <TypingDots />
                </div>
              )}
            </div>

            <div className="shrink-0 px-3 pb-3 pt-1 space-y-2">
              <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] dark:bg-black/35 pl-4 pr-1.5 py-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={t.common.helpAskAnything}
                  disabled={loading}
                  className="flex-1 min-w-0 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  aria-label={t.common.helpAskAnything}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                    input.trim() && !loading
                      ? "bg-foreground text-background hover:opacity-90"
                      : "bg-foreground/15 text-foreground/40 cursor-not-allowed"
                  )}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="px-1 text-center text-[11px] leading-snug text-muted-foreground">
                {t.common.helpDisclaimer}{" "}
                <Link
                  to="/terms"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {t.common.helpDisclaimerLink}
                </Link>
                .
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

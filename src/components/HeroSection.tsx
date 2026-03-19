import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Check, X } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllServices } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import SplitText from "@/components/SplitText";

const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-suggestions`;

type ConversationMessage = { role: "user" | "assistant"; content: string };

interface SearchResponse {
  summary?: string | null;
  suggestions?: string[];
  followUpQuestions?: string[];
  clarifyingMessage?: string | null;
  bestMatch?: { serviceName?: string; categoryName?: string } | null;
  error?: string;
  details?: string;
}

/** Canadian postal code (A1A 1A1) or US ZIP (12345 or 12345-6789). Returns true if valid. */
function isValidPostalOrZip(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  const normalized = t.replace(/\s+/g, "").toUpperCase();
  const canadian = /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized);
  const usZip = /^\d{5}(-\d{4})?$/.test(t);
  return canadian || usZip;
}

/** Find a service by name (exact or contains match, case-insensitive) for navigation */
function findServiceByName(serviceName: string): { categorySlug: string; serviceSlug: string } | null {
  const name = serviceName.trim().toLowerCase();
  if (!name) return null;
  const all = getAllServices();
  const exact = all.find((s) => s.name.toLowerCase() === name);
  if (exact) return { categorySlug: exact.categorySlug, serviceSlug: exact.slug };
  const partial = all.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()));
  if (partial) return { categorySlug: partial.categorySlug, serviceSlug: partial.slug };
  return null;
}

export default function HeroSection() {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [clarifyingMessage, setClarifyingMessage] = useState<string | null>(null);
  const [bestMatch, setBestMatch] = useState<SearchResponse["bestMatch"]>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const navigate = useNavigate();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);

  const runSearch = useCallback(
    async (userQuery: string, history: ConversationMessage[]) => {
      if (!userQuery.trim()) return;
      setLoading(true);
      setAiSummary(null);
      setSuggestions([]);
      setFollowUpQuestions([]);
      setClarifyingMessage(null);
      setBestMatch(null);
      setError(false);
      setErrorDetails(null);
      try {
        const allServices = getAllServices();
        const serviceNames = allServices.map((s) => s.name);

        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
          },
          body: JSON.stringify({
            query: userQuery.trim(),
            locale,
            conversationHistory: history,
            serviceNames,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as SearchResponse;

        if (response.ok) {
          setAiSummary(data.summary ?? null);
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setFollowUpQuestions(Array.isArray(data.followUpQuestions) ? data.followUpQuestions : []);
          setClarifyingMessage(data.clarifyingMessage ?? null);
          setBestMatch(data.bestMatch ?? null);
          setConversationHistory((prev) => [
            ...prev,
            { role: "user", content: userQuery.trim() },
            { role: "assistant", content: data.summary ?? "" },
          ]);
        } else {
          const errMsg = data.error || `Error ${response.status}`;
          const details = typeof data.details === "string" ? data.details : (data as { details?: { message?: string } }).details?.message;
          console.warn("Hero AI suggestions failed:", errMsg, details);
          setSuggestions([]);
          setAiSummary(null);
          setErrorDetails(details || errMsg);
          setError(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Search suggestions error:", err);
        setSuggestions([]);
        setAiSummary(null);
        setErrorDetails(msg);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [locale]
  );

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setAiSummary(null);
      setFollowUpQuestions([]);
      setClarifyingMessage(null);
      setBestMatch(null);
      setConversationHistory([]);
      setError(false);
      setErrorDetails(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      runSearch(query.trim(), conversationHistory);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // Auto-grow textarea when user types or when AI content appears; keep small when idle and empty
  const isActive = textareaFocused || query.length > 0 || loading || aiSummary != null;
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!isActive) {
      el.style.height = "";
      return;
    }
    const minH = 40;
    const maxH = 128;
    el.style.height = "";
    const next = Math.min(maxH, Math.max(minH, el.scrollHeight));
    el.style.height = `${next}px`;
  }, [query, isActive, loading, aiSummary]);

  const handleFollowUpClick = (followUpText: string) => {
    setQuery(followUpText);
    // Effect will run and call runSearch with updated query and current conversationHistory
  };

  const locationParam = locationQuery.trim() ? `&location=${encodeURIComponent(locationQuery.trim())}` : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const q = query.trim();
      if (aiSummary || suggestions.length > 0) {
        navigate(`/services?q=${encodeURIComponent(aiSummary || q)}${locationParam}`);
      } else {
        runSearch(q, conversationHistory);
      }
    }
  };

  const goToService = (serviceName: string) => {
    const resolved = findServiceByName(serviceName);
    if (resolved) {
      navigate(`/services/${resolved.categorySlug}/${resolved.serviceSlug}/pros${locationParam ? `?location=${encodeURIComponent(locationQuery.trim())}` : ""}`);
    } else {
      navigate(`/services?q=${encodeURIComponent(serviceName)}${locationParam}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    goToService(suggestion);
  };

  const hasResults =
    aiSummary || suggestions.length > 0 || followUpQuestions.length > 0 || clarifyingMessage || bestMatch;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <img
        src={heroBg}
        alt={t.index.heroImageAlt}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-hero-overlay" />

      <div className="container relative z-10 py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-16 md:mb-20 animate-fade-up flex flex-col items-center gap-2">
            <SplitText
              text={t.index.heroLocationLabel}
              className="text-maple-200 text-sm opacity-90 block"
              tag="p"
              splitType="chars"
              delay={35}
              duration={1}
              from={{ opacity: 0, y: 25 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.05}
              textAlign="center"
            />
            <div className="flex items-center justify-center gap-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder={t.index.heroLocationPlaceholder}
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className={`w-fit min-w-[200px] max-w-[260px] glass-card rounded-full px-5 py-2.5 text-center text-foreground placeholder:text-muted-foreground outline-none text-sm ${locationQuery.trim().length > 0 ? "pr-9" : ""}`}
                />
                {locationQuery.trim().length > 0 && (
                  <>
                    {isValidPostalOrZip(locationQuery) ? (
                      <span className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shrink-0 pointer-events-none" aria-hidden>
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full bg-red-500/90 text-white shrink-0 pointer-events-none" aria-hidden>
                        <X size={12} strokeWidth={2.5} />
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8 animate-fade-up-delay">
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold text-gradient-hero leading-tight mb-8 max-w-4xl mx-auto hero-project-title">
              <SplitText
                text={t.index.heroProjectTitle}
                className="inline-block"
                tag="span"
                splitType="words"
                delay={30}
                duration={1.1}
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.05}
                textAlign="center"
              />
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto animate-fade-up-delay-2">
            <div className="glass-card glass-hover rounded-2xl px-5 py-3 relative w-full max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <div className="relative flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    placeholder={t.index.heroProjectPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setTextareaFocused(true)}
                    onBlur={() => setTextareaFocused(false)}
                    rows={1}
                    className="w-full min-h-[2.5rem] max-h-32 bg-transparent outline-none text-foreground placeholder:text-muted-foreground px-2 py-2 pr-9 text-base resize-none overflow-y-auto transition-[height] duration-300 ease-out"
                    style={{ overflowWrap: "break-word" }}
                  />
                  {loading && (
                    <div className="absolute right-2 top-3 flex items-center gap-2">
                      <Sparkles className="text-secondary animate-pulse shrink-0" size={20} />
                    </div>
                  )}
                </div>
              </div>

              {loading && (
                <div className="mt-3 pt-3 border-t border-white/20 dark:border-gray-700/30 space-y-2">
                  <p className="text-xs font-medium text-foreground/80 px-2">{t.index.heroAiThinking}</p>
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-white/20 dark:bg-black/20">
                    <div className="h-full w-full rounded-full ai-thinking-gauge" />
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="mt-3 pt-3 border-t border-white/20 dark:border-gray-700/30 px-2 space-y-1">
                  <p className="text-sm text-amber-200 dark:text-amber-400/90">{t.index.heroAiError}</p>
                  {errorDetails && (
                    <p className="text-xs text-foreground/70 break-words" title={errorDetails}>
                      {errorDetails.length > 120 ? `${errorDetails.slice(0, 120)}…` : errorDetails}
                    </p>
                  )}
                </div>
              )}

              {hasResults && !loading && (
                <div className="mt-3 pt-3 border-t border-white/20 dark:border-gray-700/30 space-y-3 text-left">
                  {aiSummary && (
                    <p className="text-sm text-foreground/90 px-2">
                      <span className="font-semibold opacity-90">{t.index.heroWeUnderstood}</span>
                      <span className="italic">&ldquo;{aiSummary}&rdquo;</span>
                    </p>
                  )}
                  {clarifyingMessage && (
                    <p className="text-sm text-foreground/80 px-2">{clarifyingMessage}</p>
                  )}
                  {followUpQuestions.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-foreground/80 px-2">
                        {t.index.heroFollowUpPrompt}
                      </p>
                      <div className="flex flex-wrap gap-2 px-2">
                        {followUpQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleFollowUpClick(q)}
                            className="glass-card px-4 py-2.5 rounded-full text-sm font-medium text-foreground hover:bg-white/30 dark:hover:bg-gray-700/40 transition-all border border-white/20 dark:border-gray-600/30"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {bestMatch?.serviceName && (() => {
                    const resolved = findServiceByName(bestMatch.serviceName);
                    const categoryLabel = resolved && bestMatch.categoryName
                      ? getCategoryName({ name: bestMatch.categoryName, slug: resolved.categorySlug }, locale)
                      : bestMatch.categoryName ?? "";
                    const serviceLabel = resolved
                      ? getServiceName(resolved.serviceSlug, locale, bestMatch.serviceName)
                      : bestMatch.serviceName;
                    return (
                    <div className="px-2">
                      <p className="text-xs font-medium text-foreground/80 mb-2">
                        {t.index.heroBestMatch}
                      </p>
                      <button
                        type="button"
                        onClick={() => goToService(bestMatch.serviceName!)}
                        className="inline-flex items-center gap-2 glass-card px-4 py-2.5 rounded-full text-sm font-semibold text-foreground hover:bg-white/30 dark:hover:bg-gray-700/40 transition-all border border-white/20 dark:border-gray-600/30"
                      >
                        {categoryLabel ? `${categoryLabel} → ${serviceLabel}` : serviceLabel}
                        <ArrowRight size={14} />
                      </button>
                      <span className="ml-2 text-xs text-foreground/70">
                        ({t.index.heroViewPros})
                      </span>
                    </div>
                    );
                  })()}
                  {suggestions.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-foreground/80 px-2">
                        {t.index.heroChooseService}
                      </p>
                      <div className="flex flex-wrap gap-2 px-2">
                        {suggestions.map((suggestion, idx) => {
                          const resolved = findServiceByName(suggestion);
                          const label = resolved ? getServiceName(resolved.serviceSlug, locale, suggestion) : suggestion;
                          return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="glass-card px-4 py-2.5 rounded-full text-sm font-medium text-foreground hover:bg-white/30 dark:hover:bg-gray-700/40 transition-all border border-white/20 dark:border-gray-600/30"
                          >
                            {label}
                          </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

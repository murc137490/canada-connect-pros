import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllServices, getCategorySummariesForAI, getFlatServiceRecords } from "@/data/services";
import type { ServiceRecordForAI } from "@/data/services";
import { fetchProOfferedServiceRecordsForHero } from "@/lib/heroProOfferedServices";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import SplitText from "@/components/SplitText";
import { geocodePostalToLocation } from "@/lib/geocode";
import { BROWSE_POSTAL_CHANGED_EVENT, getBrowsePostalLocation, setBrowsePostalLocation } from "@/lib/browsePostalStorage";
import { cleanSupportQuery } from "@/lib/supportAiQuery";
import { searchProsByBusinessOrName, type ProBusinessSearchHit } from "@/lib/searchProBusiness";

const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-suggestions`;

interface SearchResponse {
  summary?: string | null;
  suggestions?: string[];
  followUpQuestions?: string[];
  clarifyingMessage?: string | null;
  bestMatch?: {
    serviceName?: string | null;
    categoryName?: string | null;
    serviceSlug?: string | null;
    categorySlug?: string | null;
    subcategory?: string | null;
  } | null;
  error?: string;
  details?: string;
  topFour?: {
    serviceName: string;
    serviceSlug: string;
    categorySlug: string;
    categoryName: string;
  }[];
  followUpMatches?: {
    serviceName: string;
    serviceSlug: string;
    categorySlug: string;
    categoryName: string;
  }[];
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
  const [postalCode, setPostalCode] = useState("");
  const [postalResolved, setPostalResolved] = useState<{
    lat: number;
    lng: number;
    city: string | null;
    province: string | null;
  } | null>(null);
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalError, setPostalError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [clarifyingMessage, setClarifyingMessage] = useState<string | null>(null);
  const [bestMatch, setBestMatch] = useState<SearchResponse["bestMatch"]>(null);
  const [followUpMatches, setFollowUpMatches] = useState<
    { serviceName: string; serviceSlug: string; categorySlug: string; categoryName: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [proOfferedRecords, setProOfferedRecords] = useState<ServiceRecordForAI[]>([]);
  const [proNameMatches, setProNameMatches] = useState<ProBusinessSearchHit[]>([]);
  const navigate = useNavigate();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);

  const normalizedPostal = useMemo(
    () => postalCode.trim().toUpperCase().replace(/\s+/g, " "),
    [postalCode]
  );
  const isPostalLocked = query.trim().length > 0;

  const resolvePostal = useCallback(async (): Promise<boolean> => {
    if (!normalizedPostal) return false;
    setPostalLoading(true);
    setPostalError(null);
    const geo = await geocodePostalToLocation(normalizedPostal);
    setPostalLoading(false);
    if (!geo) {
      setPostalResolved(null);
      setPostalError(t.index.checkServiceError);
      return false;
    }
    setPostalResolved({
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      province: geo.province,
    });
    return true;
  }, [normalizedPostal, t.index.checkServiceError]);

  useEffect(() => {
    const syncFromStorage = () => {
      const saved = getBrowsePostalLocation();
      if (!saved) return;
      setPostalCode(saved.postal);
      setPostalResolved({
        lat: saved.lat,
        lng: saved.lng,
        city: saved.city ?? null,
        province: saved.province ?? null,
      });
      setPostalError(null);
    };
    syncFromStorage();
    window.addEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
  }, []);

  useEffect(() => {
    if (!postalResolved || !normalizedPostal) return;
    setBrowsePostalLocation({
      postal: normalizedPostal,
      lat: postalResolved.lat,
      lng: postalResolved.lng,
      city: postalResolved.city,
      province: postalResolved.province,
    });
  }, [postalResolved, normalizedPostal]);

  /** Full catalog for HF + slug routing (stable for the session). */
  const aiCatalog = useMemo(
    () => ({
      serviceRecords: getFlatServiceRecords(),
      categorySummaries: getCategorySummariesForAI(),
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    void fetchProOfferedServiceRecordsForHero(locale).then((rows) => {
      if (!cancelled) setProOfferedRecords(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const runSearch = useCallback(
    async (userQuery: string) => {
      const cleaned = cleanSupportQuery(userQuery);
      if (!cleaned) return;
      setLoading(true);
      setSuggestions([]);
      setFollowUpMatches([]);
      setProNameMatches([]);
      setClarifyingMessage(null);
      setBestMatch(null);
      setError(false);
      setErrorDetails(null);
      try {
        const proSearchPromise = searchProsByBusinessOrName(cleaned, 6);
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
          },
          body: JSON.stringify({
            query: cleaned,
            locale,
            serviceRecords: aiCatalog.serviceRecords,
            categorySummaries: aiCatalog.categorySummaries,
            proOfferedRecords,
          }),
        });

        const [data, proHits] = await Promise.all([
          response.json().catch(() => ({})) as Promise<SearchResponse>,
          proSearchPromise,
        ]);

        setProNameMatches(proHits);

        if (response.ok) {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setClarifyingMessage(data.clarifyingMessage ?? null);
          setBestMatch(data.bestMatch ?? null);
          const follow =
            Array.isArray(data.followUpMatches) && data.followUpMatches.length > 0
              ? data.followUpMatches
              : Array.isArray(data.topFour) && data.topFour.length > 1
                ? data.topFour.slice(1, 4)
                : [];
          setFollowUpMatches(follow.filter((x) => x?.serviceSlug));
        } else {
          const errMsg = data.error || `Error ${response.status}`;
          const details = typeof data.details === "string" ? data.details : (data as { details?: { message?: string } }).details?.message;
          console.warn("Hero AI suggestions failed:", errMsg, details);
          setSuggestions([]);
          setErrorDetails(details || errMsg);
          setError(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Search suggestions error:", err);
        setSuggestions([]);
        setErrorDetails(msg);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [aiCatalog, proOfferedRecords, locale]
  );

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setClarifyingMessage(null);
      setBestMatch(null);
      setFollowUpMatches([]);
      setProNameMatches([]);
      setError(false);
      setErrorDetails(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      runSearch(query.trim());
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, runSearch]);

  // Auto-grow textarea when user types or when AI content appears; keep small when idle and empty
  const isActive =
    textareaFocused ||
    query.length > 0 ||
    loading ||
    suggestions.length > 0 ||
    followUpMatches.length > 0 ||
    bestMatch != null;
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
  }, [query, isActive, loading, suggestions.length, bestMatch, followUpMatches.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedPostal) return;
    if (query.trim()) {
      const q = query.trim();
      if (!postalResolved) {
        void resolvePostal();
        return;
      }
      const geoParams = new URLSearchParams({
        postal: normalizedPostal,
        lat: String(postalResolved.lat),
        lng: String(postalResolved.lng),
      });
      if (postalResolved.city) geoParams.set("city", postalResolved.city);
      if (postalResolved.province) geoParams.set("province", postalResolved.province);
      if (bestMatch || suggestions.length > 0 || followUpMatches.length > 0) {
        navigate(`/services?q=${encodeURIComponent(q)}&${geoParams.toString()}`);
      } else {
        runSearch(q);
      }
    }
  };

  const goToService = (serviceName: string) => {
    const resolved = findServiceByName(serviceName);
    if (resolved) {
      navigate(`/services/${resolved.categorySlug}/${resolved.serviceSlug}/pros`);
    } else {
      navigate(`/services?q=${encodeURIComponent(serviceName)}`);
    }
  };

  const goToProsFromSlugs = (categorySlug: string, serviceSlug: string) => {
    navigate(`/services/${categorySlug}/${serviceSlug}/pros`);
  };

  const hasResults =
    suggestions.length > 0 ||
    clarifyingMessage ||
    bestMatch != null ||
    followUpMatches.length > 0 ||
    proNameMatches.length > 0;

  const resultChipClass =
    "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/15";

  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-x-hidden overflow-y-visible pb-12 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:min-h-screen md:items-center md:justify-center md:overflow-hidden md:pb-0 md:pt-0">
      <img
        src={heroBg}
        alt={t.index.heroImageAlt}
        className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
      />
      <div className="absolute inset-0 bg-hero-overlay" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(222_76%_12%/0.55)] to-transparent" />

      <div className="relative z-10 w-full max-w-full px-3 py-2 md:container md:px-6 md:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 animate-fade-up font-logo text-lg tracking-tight text-white/95 drop-shadow-sm sm:text-xl md:mb-6 md:text-2xl">
            {t.index.heroBrand}
          </p>

          <div className="mb-3 animate-fade-up-delay md:mb-5">
            <h1 className="hero-project-title mx-auto mb-3 max-w-4xl px-1 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35),0_2px_24px_rgba(0,0,0,0.25)] sm:text-5xl md:mb-4 md:text-7xl">
              <SplitText
                text={t.index.heroProjectTitle}
                className="inline-block text-white"
                tag="span"
                splitType="words"
                delay={30}
                duration={1.1}
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.05}
                textAlign="center"
                playOnMount
              />
            </h1>
            <p className="mx-auto max-w-xl px-2 text-sm leading-relaxed text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] md:text-base">
              {t.index.heroSupport}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative mx-auto mt-6 max-w-2xl animate-fade-up-delay-2 md:mt-8">
            <div className="relative mx-auto w-full max-w-2xl">
              <label className="mb-2 block text-center text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
                {t.index.heroPostalHint}
              </label>
              <div className="mb-3 flex items-center justify-center">
                <input
                  type="text"
                  placeholder="A1A 1A1"
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    setPostalResolved(null);
                    setPostalError(null);
                  }}
                  onBlur={() => {
                    if (!isPostalLocked && normalizedPostal) void resolvePostal();
                  }}
                  disabled={isPostalLocked}
                  maxLength={9}
                  aria-label={t.index.heroPostalHint}
                  className={`block w-[12ch] rounded-xl border px-3 py-2.5 text-center text-sm font-medium text-white caret-white backdrop-blur-md placeholder:text-white/40 focus:outline-none focus:ring-2 disabled:text-white/50 disabled:opacity-70 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] ${
                    !postalResolved
                      ? "animate-pulse border-accent/60 bg-white/15 shadow-[0_0_20px_rgba(234,187,31,0.35)] focus:ring-accent/50"
                      : "border-white/30 bg-white/12 focus:ring-white/40"
                  }`}
                />
              </div>
              {postalLoading ? (
                <p className="mb-3 text-center text-xs text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
                  {t.makeRequest.step3Detecting}
                </p>
              ) : postalError ? (
                <p className="mb-3 text-center text-xs text-amber-200">{postalError}</p>
              ) : null}

              <div className="relative rounded-2xl border border-white/25 bg-white/10 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                {postalResolved ? (
                  <div className="mb-1.5 flex justify-end px-1">
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/95">
                      {postalResolved.city
                        ? `${postalResolved.city}${postalResolved.province ? `, ${postalResolved.province}` : ""}`
                        : normalizedPostal}
                    </span>
                  </div>
                ) : null}
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    placeholder={normalizedPostal ? t.index.heroProjectPlaceholder : t.index.heroPostalHint}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setTextareaFocused(true)}
                    onBlur={() => setTextareaFocused(false)}
                    rows={1}
                    className="w-full min-h-[2.75rem] max-h-32 resize-none overflow-y-auto bg-transparent px-2 py-2.5 pr-11 text-sm text-white caret-white outline-none transition-[height] duration-300 ease-out placeholder:text-white/55 disabled:text-white/45 disabled:placeholder:text-white/40 sm:pr-12 sm:text-base [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]"
                    style={{ overflowWrap: "break-word" }}
                    disabled={!normalizedPostal || !postalResolved}
                  />
                  {loading && (
                    <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <Sparkles className="shrink-0 animate-pulse text-accent" size={20} />
                    </div>
                  )}
                </div>

                {loading && (
                  <div className="mt-3 space-y-2 border-t border-white/20 pt-3">
                    <p className="px-1 text-xs font-medium text-white/85">{t.index.heroAiThinking}</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="ai-thinking-gauge h-full w-full rounded-full" />
                    </div>
                  </div>
                )}

                {error && !loading && (
                  <div className="mt-3 space-y-1 border-t border-white/20 px-1 pt-3">
                    <p className="text-sm text-amber-200">{t.index.heroAiError}</p>
                    {errorDetails && (
                      <p className="break-words text-xs text-white/70" title={errorDetails}>
                        {errorDetails.length > 120 ? `${errorDetails.slice(0, 120)}…` : errorDetails}
                      </p>
                    )}
                  </div>
                )}

                {hasResults && !loading && (
                  <div className="mt-3 space-y-3 border-t border-white/20 pt-3 text-left">
                    {clarifyingMessage && (
                      <p className="px-1 text-sm text-white/90">{clarifyingMessage}</p>
                    )}
                    {bestMatch?.serviceName &&
                      (() => {
                        const resolved =
                          bestMatch.serviceSlug && bestMatch.categorySlug
                            ? { categorySlug: bestMatch.categorySlug, serviceSlug: bestMatch.serviceSlug }
                            : findServiceByName(bestMatch.serviceName);
                        const categoryLabel =
                          resolved && bestMatch.categoryName
                            ? getCategoryName({ name: bestMatch.categoryName, slug: resolved.categorySlug }, locale)
                            : bestMatch.categoryName ?? "";
                        const serviceLabel = resolved
                          ? getServiceName(resolved.serviceSlug, locale, bestMatch.serviceName)
                          : bestMatch.serviceName;
                        return (
                          <div className="px-1">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/70">
                              {t.index.heroBestMatch}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  bestMatch.serviceSlug && bestMatch.categorySlug
                                    ? goToProsFromSlugs(bestMatch.categorySlug, bestMatch.serviceSlug)
                                    : goToService(bestMatch.serviceName!)
                                }
                                className={resultChipClass}
                              >
                                {categoryLabel ? `${categoryLabel} → ${serviceLabel}` : serviceLabel}
                                <ArrowRight size={14} />
                              </button>
                              <span className="text-xs text-white/70">({t.index.heroViewPros})</span>
                            </div>
                          </div>
                        );
                      })()}
                    {proNameMatches.length > 0 && (
                      <>
                        <p className="px-1 text-xs font-medium uppercase tracking-wide text-white/70">
                          {t.index.heroProMatches}
                        </p>
                        <div className="flex flex-wrap gap-2 px-1">
                          {proNameMatches.map((pro) => (
                            <button
                              key={pro.proProfileId}
                              type="button"
                              onClick={() => navigate(`/pros/${pro.proProfileId}`)}
                              className={resultChipClass}
                            >
                              {pro.businessName}
                              {pro.fullName && pro.fullName.toLowerCase() !== pro.businessName.toLowerCase()
                                ? ` (${pro.fullName})`
                                : ""}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {followUpMatches.length > 0 && (
                      <>
                        <p className="px-1 text-xs font-medium uppercase tracking-wide text-white/70">
                          {t.index.heroFollowUpServices}
                        </p>
                        <div className="flex flex-wrap gap-2 px-1">
                          {followUpMatches.map((m, idx) => {
                            const followLabel = getServiceName(m.serviceSlug, locale, m.serviceName);
                            return (
                              <button
                                key={`${m.serviceSlug}-${idx}`}
                                type="button"
                                onClick={() => goToProsFromSlugs(m.categorySlug, m.serviceSlug)}
                                className={resultChipClass}
                              >
                                {followLabel}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

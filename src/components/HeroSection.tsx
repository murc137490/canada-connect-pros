import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllServices, getCategorySummariesForAI, getFlatServiceRecords } from "@/data/services";
import type { ServiceRecordForAI } from "@/data/services";
import { fetchProOfferedServiceRecordsForHero } from "@/lib/heroProOfferedServices";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { formatCanadianPostalInput, geocodePostalToLocation, isCompleteCanadianPostal } from "@/lib/geocode";
import { BROWSE_POSTAL_CHANGED_EVENT, getBrowsePostalLocation, setBrowsePostalLocation } from "@/lib/browsePostalStorage";
import { cleanSupportQuery } from "@/lib/supportAiQuery";
import { searchProsByBusinessOrName, type ProBusinessSearchHit } from "@/lib/searchProBusiness";
import BookingPhoneMock from "@/components/BookingPhoneMock";
import HeroPostalTiltMap from "@/components/HeroPostalTiltMap";
import { Button } from "@/components/ui/button";

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

  // Auto-lookup when a full Canadian postal is entered (Google via edge/client)
  useEffect(() => {
    if (!isCompleteCanadianPostal(normalizedPostal) || isPostalLocked) return;
    if (postalResolved) return;
    const tmr = window.setTimeout(() => {
      void resolvePostal();
    }, 350);
    return () => window.clearTimeout(tmr);
  }, [normalizedPostal, isPostalLocked, postalResolved, resolvePostal]);

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
    "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted";

  return (
    <section className="relative overflow-x-hidden pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-12 md:pb-16 lg:pt-[calc(5.5rem+env(safe-area-inset-top,0px))] lg:pb-24">
      <div className="container-page">
        <div className="grid items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14 xl:gap-20">
          <div className="min-w-0">
            <p className="font-heading text-[13px] font-extrabold tracking-[-0.01em] text-foreground">
              {t.index.heroBrand}
            </p>
            <h1 className="hero-project-title mt-5 max-w-[11ch] text-display-xl text-foreground whitespace-pre-line">
              {t.index.heroProjectTitle}
            </h1>
            <p className="mt-6 max-w-[28rem] text-[17px] md:text-lg text-muted-foreground leading-relaxed">
              {t.index.heroSupport}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button size="lg" className="group h-11 px-6" asChild>
                <Link to="/make-request">
                  {t.index.ctaPublish}
                  <ArrowRight className="cta-arrow h-4 w-4" />
                </Link>
              </Button>
              <a
                href="#hero-search"
                className="text-[15px] font-semibold text-foreground/80 underline-offset-4 hover:text-foreground hover:underline transition-colors"
              >
                {t.index.ctaFindPro}
              </a>
            </div>

            <form id="hero-search" onSubmit={handleSubmit} className="mt-8 max-w-xl scroll-mt-28">
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t.index.heroSearchLabel}
              </p>
              <div className="border border-border bg-card p-3 sm:p-3.5 space-y-2.5" style={{ borderRadius: "10px" }}>
                <div className="flex flex-col gap-2">
                  <label htmlFor="hero-postal" className="text-[12px] font-medium text-muted-foreground">
                    {t.index.heroPostalHint}
                  </label>
                  <input
                    id="hero-postal"
                    type="text"
                    inputMode="text"
                    autoComplete="postal-code"
                    placeholder={t.index.heroPostalExample}
                    value={postalCode}
                    onChange={(e) => {
                      const next = formatCanadianPostalInput(e.target.value);
                      setPostalCode(next);
                      setPostalResolved(null);
                      setPostalError(null);
                    }}
                    onBlur={() => {
                      if (!isPostalLocked && normalizedPostal) void resolvePostal();
                    }}
                    disabled={isPostalLocked}
                    maxLength={7}
                    className={`w-full sm:max-w-[9.5rem] border bg-background px-3 py-2.5 text-sm font-semibold tracking-wide text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 ${
                      postalError
                        ? "border-destructive"
                        : postalResolved
                          ? "border-border"
                          : "border-border"
                    }`}
                    style={{ borderRadius: "7px" }}
                  />
                </div>

                <div className="relative min-w-0">
                  <label htmlFor="hero-need" className="sr-only">
                    {t.index.heroProjectPlaceholder}
                  </label>
                  <textarea
                    id="hero-need"
                    ref={textareaRef}
                    placeholder={
                      postalResolved
                        ? t.index.heroProjectPlaceholder
                        : t.index.heroNeedAfterPostal
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setTextareaFocused(true)}
                    onBlur={() => setTextareaFocused(false)}
                    rows={1}
                    className="w-full min-h-[2.75rem] max-h-32 resize-none overflow-y-auto border border-border/70 bg-muted/40 px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-[height] duration-300 placeholder:text-muted-foreground/70 focus:border-border focus:bg-background disabled:opacity-50 sm:text-[15px]"
                    style={{ overflowWrap: "break-word", borderRadius: "7px" }}
                    disabled={!normalizedPostal || !postalResolved}
                  />
                  {loading && (
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Sparkles className="animate-pulse text-accent" size={18} />
                    </div>
                  )}
                </div>

                {postalResolved ? (
                  <p className="px-0.5 text-xs text-muted-foreground">
                    {postalResolved.city
                      ? `${postalResolved.city}${postalResolved.province ? `, ${postalResolved.province}` : ""}`
                      : normalizedPostal}
                  </p>
                ) : null}
                {postalLoading ? (
                  <p className="px-0.5 text-xs text-muted-foreground">{t.makeRequest.step3Detecting}</p>
                ) : postalError ? (
                  <p className="px-0.5 text-xs text-destructive">{postalError}</p>
                ) : null}

                {postalResolved ? (
                  <HeroPostalTiltMap
                    key={`${postalResolved.lat},${postalResolved.lng}`}
                    lat={postalResolved.lat}
                    lng={postalResolved.lng}
                    className="pt-0.5"
                  />
                ) : null}

                {loading && (
                  <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">{t.index.heroAiThinking}</p>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div className="ai-thinking-gauge h-full w-full rounded-full" />
                    </div>
                  </div>
                )}

                {error && !loading && (
                  <div className="mt-3 border-t border-border/70 pt-3">
                    <p className="text-sm text-destructive">{t.index.heroAiError}</p>
                    {errorDetails && (
                      <p className="mt-1 break-words text-xs text-muted-foreground" title={errorDetails}>
                        {errorDetails.length > 120 ? `${errorDetails.slice(0, 120)}…` : errorDetails}
                      </p>
                    )}
                  </div>
                )}

                {hasResults && !loading && (
                  <div className="mt-3 space-y-3 border-t border-border/70 pt-3 text-left">
                    {clarifyingMessage && (
                      <p className="text-sm text-muted-foreground">{clarifyingMessage}</p>
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
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                            </div>
                          </div>
                        );
                      })()}
                    {proNameMatches.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {t.index.heroProMatches}
                        </p>
                        <div className="flex flex-wrap gap-2">
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
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {t.index.heroFollowUpServices}
                        </p>
                        <div className="flex flex-wrap gap-2">
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
            </form>
          </div>

          <div className="relative mt-6 flex justify-center lg:mt-0 lg:justify-end">
            <BookingPhoneMock alwaysLive />
          </div>
        </div>
      </div>
    </section>
  );
}

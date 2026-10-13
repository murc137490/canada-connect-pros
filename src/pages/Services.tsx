import { useState, useMemo, useCallback, useEffect, useRef, type MouseEvent } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { searchProsByBusinessOrName, type ProBusinessSearchHit } from "@/lib/searchProBusiness";
import { proPublicPath } from "@/lib/publicHandle";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { Search, ChevronRight, Loader2, LayoutGrid, LocateFixed } from "lucide-react";
import { motion } from "motion/react";
import MakeRequestButton from "@/components/MakeRequestButton";
import ServiceCategoryTile from "@/components/ServiceCategoryTile";
import {
  canadianPostalsEqual,
  detectBrowserLocationPostal,
  formatCanadianPostalInput,
  geocodePostalToLocation,
  isCompleteCanadianPostal,
  seedGeocodeCache,
} from "@/lib/geocode";
import {
  getBrowsePostalLocation,
  setBrowsePostalLocation,
  clearBrowsePostalLocation,
  BROWSE_POSTAL_CHANGED_EVENT,
} from "@/lib/browsePostalStorage";
import { useToast } from "@/hooks/use-toast";
import { MOTION } from "@/motion/types";
import ProServicesModeSwitcher from "@/components/services/ProServicesModeSwitcher";
import TopServicesGallery from "@/components/services/TopServicesGallery";

export default function Services() {
  const { locale, t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const fromBrowsePros = Boolean((location.state as { fromBrowsePros?: boolean } | null)?.fromBrowsePros);
  const [searchParams] = useSearchParams();
  const clientMode = searchParams.get("mode") === "client";
  const modeSearch = clientMode ? "?mode=client" : "";
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [proNameMatches, setProNameMatches] = useState<ProBusinessSearchHit[]>([]);
  const [proNameSearchLoading, setProNameSearchLoading] = useState(false);

  const [postalCode, setPostalCode] = useState("");
  const [postalResolved, setPostalResolved] = useState<{
    lat: number;
    lng: number;
    city: string | null;
    province: string | null;
  } | null>(null);
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalError, setPostalError] = useState<string | null>(null);
  const postalEditedRef = useRef(false);
  const postalResolvedRef = useRef(postalResolved);
  postalResolvedRef.current = postalResolved;
  const locationDetectOnceRef = useRef(false);
  const locationDetectGenRef = useRef(0);
  const postalInputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);

  useScrollRestore("altshift:scroll:/services");

  const normalizedPostal = useMemo(
    () => postalCode.trim().toUpperCase().replace(/\s+/g, " "),
    [postalCode]
  );

  const canBrowseServices = !!postalResolved;

  useEffect(() => {
    const saved = getBrowsePostalLocation();
    if (!saved) return;
    seedGeocodeCache(saved.postal, saved);
    setPostalCode(saved.postal);
    setPostalResolved({
      lat: saved.lat,
      lng: saved.lng,
      city: saved.city ?? null,
      province: saved.province ?? null,
    });
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
    seedGeocodeCache(normalizedPostal, postalResolved);
  }, [postalResolved, normalizedPostal]);

  useEffect(() => {
    const syncFromStorage = () => {
      if (postalEditedRef.current) return;
      const saved = getBrowsePostalLocation();
      if (!saved) {
        setPostalCode("");
        setPostalResolved(null);
        return;
      }
      seedGeocodeCache(saved.postal, saved);
      setPostalCode(saved.postal);
      setPostalResolved({
        lat: saved.lat,
        lng: saved.lng,
        city: saved.city ?? null,
        province: saved.province ?? null,
      });
    };
    window.addEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
  }, []);

  const resolvePostal = useCallback(async (): Promise<boolean> => {
    if (!normalizedPostal) {
      setPostalResolved(null);
      setPostalError(null);
      return false;
    }
    setPostalLoading(true);
    setPostalError(null);
    const geo = await geocodePostalToLocation(normalizedPostal);
    setPostalLoading(false);
    if (!geo) {
      const saved = getBrowsePostalLocation();
      if (saved && canadianPostalsEqual(saved.postal, normalizedPostal)) {
        setPostalResolved({
          lat: saved.lat,
          lng: saved.lng,
          city: saved.city ?? null,
          province: saved.province ?? null,
        });
        setPostalError(null);
        return true;
      }
      setPostalResolved(null);
      setPostalError(t.services.postalInvalid);
      return false;
    }
    setPostalResolved({
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      province: geo.province,
    });
    return true;
  }, [normalizedPostal, t.services.postalInvalid]);

  const applyDetectedLocation = useCallback(
    async (opts?: { fromEmptyFocus?: boolean }) => {
      if (locating || postalLoading) return;
      if (opts?.fromEmptyFocus && (postalCode.trim() || locationDetectOnceRef.current)) return;
      if (opts?.fromEmptyFocus) locationDetectOnceRef.current = true;

      const gen = ++locationDetectGenRef.current;
      setLocating(true);
      setPostalError(null);
      const result = await detectBrowserLocationPostal();
      if (gen !== locationDetectGenRef.current) return;
      setLocating(false);

      if (!result.ok) {
        const msg =
          result.reason === "denied"
            ? t.services.postalLocationDenied
            : result.reason === "no_postal"
              ? t.services.postalLocationNoPostal
              : result.reason === "timeout"
                ? t.services.postalLocationTimeout
                : t.services.postalLocationUnavailable;
        setPostalError(msg);
        return;
      }

      const postal = result.location.postal!;
      postalEditedRef.current = true;
      setPostalCode(postal);
      setPostalResolved({
        lat: result.location.lat,
        lng: result.location.lng,
        city: result.location.city,
        province: result.location.province,
      });
      setPostalError(null);
      seedGeocodeCache(postal, result.location);
      requestAnimationFrame(() => {
        postalEditedRef.current = false;
      });
    },
    [
      locating,
      postalLoading,
      postalCode,
      t.services.postalLocationDenied,
      t.services.postalLocationNoPostal,
      t.services.postalLocationTimeout,
      t.services.postalLocationUnavailable,
    ],
  );

  useEffect(() => {
    if (!isCompleteCanadianPostal(normalizedPostal)) return;
    let cancelled = false;
    const requested = normalizedPostal;
    const tmr = window.setTimeout(() => {
      void (async () => {
        setPostalLoading(true);
        setPostalError(null);
        const geo = await geocodePostalToLocation(requested);
        if (cancelled) return;
        setPostalLoading(false);
        if (requested !== normalizedPostal) return;
        if (!geo) {
          const saved = getBrowsePostalLocation();
          if (saved && canadianPostalsEqual(saved.postal, requested)) {
            setPostalResolved({
              lat: saved.lat,
              lng: saved.lng,
              city: saved.city ?? null,
              province: saved.province ?? null,
            });
            setPostalError(null);
            return;
          }
          if (postalResolvedRef.current) {
            setPostalError(null);
            return;
          }
          setPostalResolved(null);
          setPostalError(t.services.postalInvalid);
          return;
        }
        setPostalResolved({
          lat: geo.lat,
          lng: geo.lng,
          city: geo.city,
          province: geo.province,
        });
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(tmr);
    };
  }, [normalizedPostal, t.services.postalInvalid]);

  const warnPostalFirst = useCallback(() => {
    setPostalError(t.services.postalEnterFirstDesc);
    postalInputRef.current?.focus({ preventScroll: false });
    postalInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast({
      title: t.services.postalEnterFirstToast,
      description: t.services.postalEnterFirstDesc,
      duration: 12000,
    });
  }, [toast, t.services]);

  const guardClick = useCallback(
    (e: MouseEvent) => {
      if (!canBrowseServices) {
        e.preventDefault();
        warnPostalFirst();
      }
    },
    [canBrowseServices, warnPostalFirst]
  );

  const allServices = useMemo(() => getAllServices(), []);

  const top5MostSearched = useMemo(() => {
    const slugs = [
      "plumbing-services",
      "electrical-services",
      "house-cleaning",
      "hvac-services",
      "bathroom-remodel",
    ];
    return slugs
      .map((slug) => allServices.find((s) => s.slug === slug))
      .filter((s): s is (typeof allServices)[number] => !!s);
  }, [allServices]);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    return allServices.filter(
      (s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase()) ||
        s.subcategory.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allServices]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setProNameMatches([]);
      setProNameSearchLoading(false);
      return;
    }
    let cancelled = false;
    setProNameSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchProsByBusinessOrName(q, 8).then((hits) => {
        if (!cancelled) {
          setProNameMatches(hits);
          setProNameSearchLoading(false);
        }
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <Layout>
      <motion.div
        className="min-h-screen bg-background"
        initial={fromBrowsePros ? { opacity: 0, y: 22, filter: "blur(6px)" } : false}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: MOTION.reveal, ease: MOTION.ease }}
      >
        <ProServicesModeSwitcher />
        <div className="border-b border-border bg-muted/40">
          <div className="container py-8 md:py-10">
            <div className="flex flex-col gap-6">
              <div className="min-w-0">
                <div className="mb-4 flex items-start gap-4">
                  <div
                    className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary sm:flex"
                    aria-hidden
                  >
                    <LayoutGrid className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                      {t.services.title}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                      {t.services.subtitle}
                    </p>
                  </div>
                </div>
                <div className="relative max-w-xl">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t.services.searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-secondary/50"
                  />
                </div>
              </div>

              <div className="group mx-auto flex w-full max-w-xl flex-col items-center gap-2">
                <p className="min-h-[1.25rem] text-center text-sm text-muted-foreground opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
                  {t.services.receiveResponse}
                </p>
                <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <div className="mx-auto flex w-full max-w-[min(100%,20rem)] flex-col items-center justify-center gap-1.5 p-2 min-h-[3.25rem] sm:mx-0 sm:max-w-none sm:min-w-[14rem] sm:flex-1">
                    {postalLoading || locating ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t.services.postalDetecting}
                      </p>
                    ) : null}
                    <div className="flex w-full items-center gap-2">
                      <input
                        ref={postalInputRef}
                        type="text"
                        inputMode="text"
                        autoComplete="postal-code"
                        placeholder="A1A 1A1"
                        value={postalCode}
                        onChange={(e) => {
                          postalEditedRef.current = true;
                          locationDetectGenRef.current += 1;
                          if (locating) setLocating(false);
                          const next = formatCanadianPostalInput(e.target.value);
                          setPostalCode(next);
                          setPostalError(null);
                          if (!next.trim()) {
                            setPostalResolved(null);
                            clearBrowsePostalLocation();
                          } else if (!isCompleteCanadianPostal(next)) {
                            setPostalResolved(null);
                          }
                        }}
                        onFocus={() => {
                          if (!postalCode.trim()) void applyDetectedLocation({ fromEmptyFocus: true });
                        }}
                        onBlur={() => {
                          postalEditedRef.current = false;
                          if (normalizedPostal) void resolvePostal();
                        }}
                        maxLength={7}
                        className={`block w-full min-w-0 sm:min-w-[12.5rem] rounded-lg border px-3 py-2.5 text-center text-sm text-foreground bg-background outline-none focus:ring-2 ${
                          !postalResolved
                            ? "border-accent/55 focus:ring-accent/40"
                            : "border-border focus:ring-ring"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => void applyDetectedLocation()}
                        disabled={locating || postalLoading}
                        title={t.services.postalUseLocation}
                        aria-label={t.services.postalUseLocation}
                        className="inline-flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      >
                        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                      </button>
                    </div>
                    {postalError ? (
                      <p className="px-1 text-center text-xs text-amber-600 dark:text-amber-400/90">{postalError}</p>
                    ) : postalResolved ? (
                      <p className="max-w-full truncate px-1 text-center text-xs text-muted-foreground">
                        {postalResolved.city
                          ? `${postalResolved.city}${postalResolved.province ? `, ${postalResolved.province}` : ""}`
                          : normalizedPostal}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 justify-center">
                    <MakeRequestButton label={t.services.makeARequest} to="/make-request" />
                  </div>
                </div>
                <p className="min-h-[1.25rem] text-center text-sm text-muted-foreground opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
                  {t.services.under24Hours}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-10">
          {filtered !== null ? (
            <div>
              <p className="text-sm text-muted-foreground mb-6">
                {filtered.length}{" "}
                {filtered.length === 1 ? t.services.resultsCount : t.services.resultsCountPlural} for &quot;{query}
                &quot;
              </p>
              {(proNameSearchLoading || proNameMatches.length > 0) && (
                <div className="mb-8">
                  <h2 className="font-heading text-lg font-bold text-foreground mb-3">
                    {t.services.proMatches ?? "Professionals & companies"}
                  </h2>
                  {proNameSearchLoading && proNameMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.services.proMatchesLoading ?? "Searching pros…"}
                    </p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {proNameMatches.map((pro) => (
                        <Link
                          key={pro.proProfileId}
                          to={proPublicPath({ id: pro.proProfileId, share_slug: pro.shareSlug })}
                          className="rounded-xl border-2 border-secondary/50 bg-card p-4 flex items-center justify-between hover:border-secondary hover:shadow-md transition-all"
                        >
                          <div>
                            <h3 className="font-medium text-card-foreground">{pro.businessName}</h3>
                            {pro.fullName && pro.fullName.toLowerCase() !== pro.businessName.toLowerCase() ? (
                              <p className="text-xs text-muted-foreground">{pro.fullName}</p>
                            ) : null}
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {filtered.length === 0 && proNameMatches.length === 0 && !proNameSearchLoading ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg">{t.services.noResults}</p>
                </div>
              ) : filtered.length === 0 ? null : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((s) => (
                    <Link
                      key={`${s.category}-${s.slug}`}
                      to={`/services/${s.categorySlug}/${s.slug}${modeSearch}`}
                      onClick={guardClick}
                      className="rounded-xl border-2 border-primary/60 bg-card p-4 flex items-center justify-between cursor-pointer hover:border-primary hover:shadow-md transition-all text-foreground dark:text-white dark:border-primary/80 dark:hover:border-primary"
                    >
                      <div>
                        <h3 className="font-medium text-card-foreground dark:text-white">
                          {getServiceName(s.slug, locale, s.name)}
                        </h3>
                        <p className="text-xs text-muted-foreground dark:text-white/80">
                          {getCategoryName({ name: s.category, slug: s.categorySlug }, locale)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground dark:text-white/80 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {top5MostSearched.length > 0 && (
                <section>
                  <h2 className="mb-3 font-heading text-base font-bold tracking-tight text-foreground sm:mb-5 sm:text-xl md:text-2xl">
                    {t.services.top5MostSearched}
                  </h2>
                  {/* Phone: compact name-only list */}
                  <div className="flex flex-col gap-1.5 sm:hidden">
                    {top5MostSearched.map((s) => (
                      <Link
                        key={`${s.categorySlug}-${s.slug}`}
                        to={`/services/${s.categorySlug}/${s.slug}`}
                        onClick={guardClick}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground active:bg-muted"
                      >
                        <span className="truncate">{getServiceName(s.slug, locale, s.name)}</span>
                        <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                  {/* Tablet/desktop: image cards */}
                  <div className="hidden sm:block">
                    <TopServicesGallery items={top5MostSearched} onGuardClick={guardClick} modeSearch={modeSearch} />
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-3 font-heading text-base font-bold tracking-tight text-foreground sm:mb-5 sm:text-xl md:text-2xl">
                  {t.services.browseCategories}
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 md:gap-5">
                  {serviceCategories.map((cat, index) => (
                    <ServiceCategoryTile
                      key={cat.slug}
                      category={cat}
                      index={index}
                      locked={!canBrowseServices}
                      onGuardClick={guardClick}
                      servicesLabel={t.services.servicesCount}
                      search={modeSearch}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </motion.div>
    </Layout>
  );
}

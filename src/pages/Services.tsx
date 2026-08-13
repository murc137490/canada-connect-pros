import { useState, useMemo, useCallback, useEffect, useRef, type MouseEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { searchProsByBusinessOrName, type ProBusinessSearchHit } from "@/lib/searchProBusiness";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { Search, ChevronRight, Loader2, LayoutGrid } from "lucide-react";
import { motion } from "motion/react";
import MakeRequestButton from "@/components/MakeRequestButton";
import ServiceCategoryTile from "@/components/ServiceCategoryTile";
import { popularServiceVisuals, popularServiceSrcSet } from "@/data/categoryVisuals";
import { formatCanadianPostalInput, geocodePostalToLocation, isCompleteCanadianPostal } from "@/lib/geocode";
import {
  getBrowsePostalLocation,
  setBrowsePostalLocation,
  clearBrowsePostalLocation,
  BROWSE_POSTAL_CHANGED_EVENT,
} from "@/lib/browsePostalStorage";
import { useToast } from "@/hooks/use-toast";

export default function Services() {
  const { locale, t } = useLanguage();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
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

  useScrollRestore("premiere:scroll:/services");

  const normalizedPostal = useMemo(
    () => postalCode.trim().toUpperCase().replace(/\s+/g, " "),
    [postalCode]
  );

  const canBrowseServices = !!postalResolved;

  useEffect(() => {
    const saved = getBrowsePostalLocation();
    if (!saved) return;
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
    toast({
      title: t.services.postalEnterFirstToast,
      description: t.services.postalEnterFirstDesc,
      variant: "destructive",
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
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-muted/40">
          <div className="container py-8 md:py-10">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0 flex-1">
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
              <div className="group flex flex-col items-center lg:items-end gap-2 shrink-0 w-full lg:w-auto">
                <p className="text-sm text-muted-foreground text-center lg:text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 min-h-[1.25rem]">
                  {t.services.receiveResponse}
                </p>
                <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 w-full max-w-md lg:max-w-none lg:justify-end">
                  <div className="flex flex-col items-center justify-center gap-1.5 p-2 min-h-[3.25rem] w-full sm:flex-1 sm:min-w-[14rem] lg:min-w-[16rem] max-w-[min(100%,20rem)] sm:max-w-none mx-auto sm:mx-0">
                    {postalLoading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t.services.postalDetecting}
                      </p>
                    ) : null}
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="postal-code"
                      placeholder="A1A 1A1"
                      value={postalCode}
                      onChange={(e) => {
                        postalEditedRef.current = true;
                        const next = formatCanadianPostalInput(e.target.value);
                        setPostalCode(next);
                        setPostalResolved(null);
                        setPostalError(null);
                        if (!next.trim()) clearBrowsePostalLocation();
                      }}
                      onBlur={() => {
                        postalEditedRef.current = false;
                        if (normalizedPostal) void resolvePostal();
                      }}
                      maxLength={7}
                      className={`block w-full min-w-[12.5rem] sm:min-w-[14rem] rounded-lg border px-3 py-2.5 text-center text-sm text-foreground bg-background outline-none focus:ring-2 ${
                        !postalResolved
                          ? "border-accent/55 focus:ring-accent/40"
                          : "border-border focus:ring-ring"
                      }`}
                    />
                    {postalError ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400/90 text-center px-1">{postalError}</p>
                    ) : postalResolved ? (
                      <p className="text-xs text-muted-foreground text-center truncate max-w-full px-1">
                        {postalResolved.city
                          ? `${postalResolved.city}${postalResolved.province ? `, ${postalResolved.province}` : ""}`
                          : normalizedPostal}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-center sm:justify-end shrink-0">
                    <MakeRequestButton label={t.services.makeARequest} to="/make-request" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center lg:text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 min-h-[1.25rem]">
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
                          to={`/pros/${pro.proProfileId}`}
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
                      to={`/services/${s.categorySlug}/${s.slug}`}
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
                  <h2 className="mb-5 font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {t.services.top5MostSearched}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {top5MostSearched.map((s, i) => (
                      <motion.div
                        key={`${s.categorySlug}-${s.slug}`}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05, duration: 0.45 }}
                      >
                        <Link
                          to={`/services/${s.categorySlug}/${s.slug}`}
                          onClick={guardClick}
                          className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                        >
                          <div className="relative aspect-[5/4] overflow-hidden">
                            <img
                              src={popularServiceVisuals[s.slug] ?? popularServiceVisuals["plumbing-services"]}
                              srcSet={popularServiceSrcSet(s.slug) ?? popularServiceSrcSet("plumbing-services")}
                              sizes="(min-width: 1024px) 18vw, (min-width: 640px) 45vw, 100vw"
                              alt={getServiceName(s.slug, locale, s.name)}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-3.5">
                              <p className="font-heading text-sm font-bold text-white">
                                {getServiceName(s.slug, locale, s.name)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-white/80">
                                {getCategoryName({ name: s.category, slug: s.categorySlug }, locale)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-5 font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">
                  {t.services.browseCategories}
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {serviceCategories.map((cat, index) => (
                    <ServiceCategoryTile
                      key={cat.slug}
                      category={cat}
                      index={index}
                      locked={!canBrowseServices}
                      onGuardClick={guardClick}
                      servicesLabel={t.services.servicesCount}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

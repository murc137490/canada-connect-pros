import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, LocateFixed, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOTION } from "@/motion/types";
import { getAllServices, getCategorySummariesForAI, getFlatServiceRecords } from "@/data/services";
import type { ServiceRecordForAI } from "@/data/services";
import { fetchProOfferedServiceRecordsForHero } from "@/lib/heroProOfferedServices";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import {
  canadianPostalsEqual,
  detectBrowserLocationPostal,
  formatCanadianPostalInput,
  geocodePostalToLocation,
  isCompleteCanadianPostal,
  seedGeocodeCache,
} from "@/lib/geocode";
import {
  BROWSE_POSTAL_CHANGED_EVENT,
  clearBrowsePostalLocation,
  getBrowsePostalLocation,
  setBrowsePostalLocation,
} from "@/lib/browsePostalStorage";
import { cleanSupportQuery } from "@/lib/supportAiQuery";
import { searchProsByBusinessOrName, type ProBusinessSearchHit } from "@/lib/searchProBusiness";
import { proPublicPath } from "@/lib/publicHandle";
import BookingPhoneMock from "@/components/BookingPhoneMock";
import HeroPostalTiltMap from "@/components/HeroPostalTiltMap";
import TechText from "@/components/motion/TechText";
import SpecularButton from "@/components/motion/SpecularButton";
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

/** Common EN/FR keywords → service/category (so "plumber" finds Plumbing Services). */
const SERVICE_SEARCH_ALIASES: { keywords: string[]; categorySlug: string; serviceSlug: string }[] = [
  { keywords: ["plumber", "plumbing", "plombier", "plomberie"], categorySlug: "home-improvement", serviceSlug: "plumbing-services" },
  { keywords: ["electrician", "electrical", "électricien", "electricien", "électricité", "electricite"], categorySlug: "home-improvement", serviceSlug: "electrical-services" },
  { keywords: ["hvac", "heating", "cooling", "climatisation", "chauffage"], categorySlug: "home-improvement", serviceSlug: "hvac-services" },
  { keywords: ["cleaner", "cleaning", "ménage", "menage", "housekeeping"], categorySlug: "cleaning", serviceSlug: "house-cleaning" },
  { keywords: ["roofer", "roofing", "toiture", "couvreur"], categorySlug: "home-improvement", serviceSlug: "roof-repair" },
  { keywords: ["painter", "painting", "peintre", "peinture"], categorySlug: "home-improvement", serviceSlug: "interior-painting" },
  { keywords: ["landscaper", "landscaping", "paysagiste", "aménagement", "amenagement"], categorySlug: "outdoor-seasonal", serviceSlug: "landscaping-services" },
];

/** Find a service by name, alias keyword, or contains match (case-insensitive). */
function findServiceByName(serviceName: string): { categorySlug: string; serviceSlug: string } | null {
  const name = serviceName.trim().toLowerCase();
  if (!name) return null;
  const all = getAllServices();
  const exact = all.find((s) => s.name.toLowerCase() === name);
  if (exact) return { categorySlug: exact.categorySlug, serviceSlug: exact.slug };
  for (const alias of SERVICE_SEARCH_ALIASES) {
    if (alias.keywords.some((k) => name === k || name.includes(k) || k.includes(name))) {
      const hit = all.find((s) => s.slug === alias.serviceSlug && s.categorySlug === alias.categorySlug);
      if (hit) return { categorySlug: hit.categorySlug, serviceSlug: hit.slug };
      return { categorySlug: alias.categorySlug, serviceSlug: alias.serviceSlug };
    }
  }
  const partial = all.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()));
  if (partial) return { categorySlug: partial.categorySlug, serviceSlug: partial.slug };
  // Also match FR names from bilingual catalog via slugify-ish contains on service name tokens
  const tokenHit = all.find((s) => {
    const tokens = s.name.toLowerCase().split(/[^a-z0-9àâäéèêëïîôùûüç]+/i).filter((t) => t.length >= 4);
    return tokens.some((t) => name.includes(t) || t.includes(name));
  });
  if (tokenHit) return { categorySlug: tokenHit.categorySlug, serviceSlug: tokenHit.slug };
  return null;
}

const TECH_SUPPORT_QUERY = /\b(iphone|ipad|android|mobile|smartphone|cell phone|computer|laptop|macbook|tablet|it support|tech support|device repair)\b/i;
const GENERIC_QUERY_WORDS = new Set("i want to learn about help support repair fixing fix service services the a an my for me with how can you please need looking get and le la les des de du un une pour apprendre aide soutien réparation service services comment veux voudrais mon ma mes avec obtenir chercher".split(" "));

function findDirectProServiceMatch(query: string, records: ServiceRecordForAI[]): ServiceRecordForAI | null {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const queryTerms = normalize(query).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !GENERIC_QUERY_WORDS.has(word));
  if (!queryTerms.length) return null;

  let best: ServiceRecordForAI | null = null;
  let bestScore = 0;
  for (const record of records) {
    const nameTerms = new Set(normalize(record.name).split(/[^a-z0-9]+/).filter(Boolean));
    const matched = queryTerms.filter((word) => nameTerms.has(word));
    const score = matched.reduce((total, word) => total + Math.min(word.length, 10), 0);
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return best;
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
  const [proOfferedRecords, setProOfferedRecords] = useState<ServiceRecordForAI[]>([]);
  const [proNameMatches, setProNameMatches] = useState<ProBusinessSearchHit[]>([]);
  const navigate = useNavigate();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const postalEditedRef = useRef(false);
  const postalResolvedRef = useRef(postalResolved);
  postalResolvedRef.current = postalResolved;
  const locationDetectOnceRef = useRef(false);
  const [locating, setLocating] = useState(false);
  const [browseLeaving, setBrowseLeaving] = useState(false);
  const goBrowseServices = useCallback(() => {
    if (browseLeaving) return;
    setBrowseLeaving(true);
    window.setTimeout(() => {
      navigate("/services", { state: { fromBrowsePros: true } });
    }, 320);
  }, [browseLeaving, navigate]);

  const normalizedPostal = useMemo(
    () => postalCode.trim().toUpperCase().replace(/\s+/g, " "),
    [postalCode]
  );

  const resolvePostal = useCallback(async (): Promise<boolean> => {
    if (!normalizedPostal) return false;
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

  const applyDetectedLocation = useCallback(
    async (opts?: { fromEmptyFocus?: boolean }) => {
      if (locating || postalLoading) return;
      if (opts?.fromEmptyFocus && (postalCode.trim() || locationDetectOnceRef.current)) return;
      if (opts?.fromEmptyFocus) locationDetectOnceRef.current = true;

      setLocating(true);
      setPostalError(null);
      const result = await detectBrowserLocationPostal();
      setLocating(false);

      if (!result.ok) {
        const msg =
          result.reason === "denied"
            ? t.index.heroPostalLocationDenied
            : result.reason === "no_postal"
              ? t.index.heroPostalLocationNoPostal
              : result.reason === "timeout"
                ? t.index.heroPostalLocationTimeout
                : t.index.heroPostalLocationUnavailable;
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
      // Allow blur/auto-resolve to settle after we set edited flag briefly
      requestAnimationFrame(() => {
        postalEditedRef.current = false;
      });
    },
    [
      locating,
      postalLoading,
      postalCode,
      t.index.heroPostalLocationDenied,
      t.index.heroPostalLocationNoPostal,
      t.index.heroPostalLocationTimeout,
      t.index.heroPostalLocationUnavailable,
    ],
  );

  // Auto-lookup when a full Canadian postal is entered (always re-resolve on change).
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
        // Ignore stale responses if the user kept typing.
        if (requested !== normalizedPostal) return;
        if (!geo) {
          // Refresh / rate-limit: keep saved or already-resolved coords for this postal.
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
          setPostalError(t.index.checkServiceError);
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
  }, [normalizedPostal, t.index.checkServiceError]);

  useEffect(() => {
    let cancelled = false;
    const applySaved = (saved: NonNullable<ReturnType<typeof getBrowsePostalLocation>>) => {
      seedGeocodeCache(saved.postal, saved);
      setPostalCode(saved.postal);
      setPostalResolved({
        lat: saved.lat,
        lng: saved.lng,
        city: saved.city ?? null,
        province: saved.province ?? null,
      });
      setPostalError(null);
    };
    const syncFromStorage = () => {
      const saved = getBrowsePostalLocation();
      if (!saved) {
        if (postalEditedRef.current) {
          // User cleared, keep empty field, don't restore.
          return;
        }
        return;
      }
      // Never overwrite while the user is editing the postal field.
      if (postalEditedRef.current) return;
      applySaved(saved);
      if (isCompleteCanadianPostal(saved.postal)) {
        void geocodePostalToLocation(saved.postal).then((geo) => {
          if (cancelled || !geo || postalEditedRef.current) return;
          setPostalResolved({
            lat: geo.lat,
            lng: geo.lng,
            city: geo.city,
            province: geo.province,
          });
        });
      }
    };
    syncFromStorage();
    window.addEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(BROWSE_POSTAL_CHANGED_EVENT, syncFromStorage);
    };
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
          const techFocused = TECH_SUPPORT_QUERY.test(cleaned);
          const directProService = techFocused ? findDirectProServiceMatch(cleaned, proOfferedRecords) : null;
          setSuggestions(techFocused ? [] : Array.isArray(data.suggestions) ? data.suggestions : []);
          setClarifyingMessage(techFocused ? null : data.clarifyingMessage ?? null);
          let match = data.bestMatch ?? null;
          if (!match?.serviceSlug) {
            const local = findServiceByName(cleaned);
            if (local) {
              const svc = getAllServices().find((s) => s.slug === local.serviceSlug && s.categorySlug === local.categorySlug);
              match = {
                serviceName: svc?.name ?? cleaned,
                categoryName: svc?.category ?? null,
                serviceSlug: local.serviceSlug,
                categorySlug: local.categorySlug,
              };
            }
          }
          const itSupport = aiCatalog.serviceRecords.find((record) => record.slug === "it-support");
          if (techFocused && directProService) {
            match = {
              serviceName: directProService.name,
              categoryName: directProService.categoryName,
              serviceSlug: directProService.slug,
              categorySlug: directProService.categorySlug,
            };
          } else if (techFocused && itSupport) {
            match = {
              serviceName: itSupport.name,
              categoryName: itSupport.categoryName,
              serviceSlug: itSupport.slug,
              categorySlug: itSupport.categorySlug,
            };
          }
          setBestMatch(match);
          const follow =
            Array.isArray(data.followUpMatches) && data.followUpMatches.length > 0
              ? data.followUpMatches
              : Array.isArray(data.topFour) && data.topFour.length > 1
                ? data.topFour.slice(1, 4)
                : [];
          if (techFocused) {
            setFollowUpMatches(directProService && itSupport && directProService.name.toLowerCase() !== itSupport.name.toLowerCase()
              ? [{ serviceName: itSupport.name, serviceSlug: itSupport.slug, categorySlug: itSupport.categorySlug, categoryName: itSupport.categoryName }]
              : []);
          } else {
            setFollowUpMatches(follow.filter((x) => x?.serviceSlug));
          }
        } else {
          const techFocused = TECH_SUPPORT_QUERY.test(cleaned);
          const directProService = techFocused ? findDirectProServiceMatch(cleaned, proOfferedRecords) : null;
          const local = findServiceByName(cleaned);
          if (!techFocused && local) {
            const svc = getAllServices().find((s) => s.slug === local.serviceSlug && s.categorySlug === local.categorySlug);
            setBestMatch({
              serviceName: svc?.name ?? cleaned,
              categoryName: svc?.category ?? null,
              serviceSlug: local.serviceSlug,
              categorySlug: local.categorySlug,
            });
            setSuggestions([]);
            setError(false);
          } else if (techFocused) {
            const itSupport = aiCatalog.serviceRecords.find((record) => record.slug === "it-support");
            const selected = directProService ?? itSupport;
            if (selected) {
              setBestMatch({
                serviceName: selected.name,
                categoryName: selected.categoryName,
                serviceSlug: selected.slug,
                categorySlug: selected.categorySlug,
              });
              setFollowUpMatches(directProService && itSupport && directProService.name.toLowerCase() !== itSupport.name.toLowerCase()
                ? [{ serviceName: itSupport.name, serviceSlug: itSupport.slug, categorySlug: itSupport.categorySlug, categoryName: itSupport.categoryName }]
                : []);
              setSuggestions([]);
              setError(false);
            } else {
              setSuggestions([]);
              setError(true);
            }
          } else {
            setSuggestions([]);
            setError(true);
          }
        }
      } catch {
        setSuggestions([]);
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
      return;
    }

    debounceTimer.current = setTimeout(() => {
      runSearch(query.trim());
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, runSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const q = query.trim();
      if (normalizedPostal && !postalResolved) {
        void resolvePostal();
        return;
      }
      const geoParams = new URLSearchParams();
      if (postalResolved && normalizedPostal) {
        geoParams.set("postal", normalizedPostal);
        geoParams.set("lat", String(postalResolved.lat));
        geoParams.set("lng", String(postalResolved.lng));
        if (postalResolved.city) geoParams.set("city", postalResolved.city);
        if (postalResolved.province) geoParams.set("province", postalResolved.province);
      }
      const queryString = geoParams.toString();
      const suffix = queryString ? `?${queryString}` : "";
      const localService = findServiceByName(q);
      if (localService) {
        navigate(`/services/${localService.categorySlug}/${localService.serviceSlug}/pros${suffix}`);
        return;
      }
      if (bestMatch?.categorySlug && bestMatch?.serviceSlug) {
        navigate(`/services/${bestMatch.categorySlug}/${bestMatch.serviceSlug}/pros${suffix}`);
        return;
      }
      if (bestMatch || suggestions.length > 0 || followUpMatches.length > 0 || proNameMatches.length > 0) {
        navigate(`/services?q=${encodeURIComponent(q)}${queryString ? `&${queryString}` : ""}`);
      } else {
        runSearch(q);
      }
    }
  };

  const goToService = (serviceName: string) => {
    const resolved = findServiceByName(serviceName);
    if (resolved) {
      goToProsFromSlugs(resolved.categorySlug, resolved.serviceSlug);
    } else {
      navigate(`/services?q=${encodeURIComponent(serviceName)}`);
    }
  };

  const goToProsFromSlugs = (categorySlug: string, serviceSlug: string) => {
    const params = new URLSearchParams();
    if (postalResolved && normalizedPostal) {
      params.set("postal", normalizedPostal);
      params.set("lat", String(postalResolved.lat));
      params.set("lng", String(postalResolved.lng));
      if (postalResolved.city) params.set("city", postalResolved.city);
      if (postalResolved.province) params.set("province", postalResolved.province);
    }
    const suffix = params.toString();
    navigate(`/services/${categorySlug}/${serviceSlug}/pros${suffix ? `?${suffix}` : ""}`);
  };

  const hasResults =
    suggestions.length > 0 ||
    clarifyingMessage ||
    bestMatch != null ||
    followUpMatches.length > 0 ||
    proNameMatches.length > 0;

  return (
    <motion.section
      className="relative overflow-x-hidden pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-8 md:pb-10 lg:pt-[calc(5.5rem+env(safe-area-inset-top,0px))] lg:pb-14"
      animate={browseLeaving ? { opacity: 0, y: -18, filter: "blur(4px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
    >
      <div className="container-page">
        <div className="grid items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14 xl:gap-20">
          <div className="min-w-0">
            <h1 className="sr-only">{t.index.heroProjectTitle.replace("\n", " ")}</h1>
            <div className="hero-project-title mt-2 w-full text-foreground" aria-hidden="true">
              {t.index.heroProjectTitle.split("\n").map((line, index) => (
                <TechText
                  key={`${index}-${line}`}
                  text={line}
                  className="h-[clamp(6rem,10vw,9rem)] w-full"
                  fontSize={138}
                  align="left"
                  fontWeight={800}
                  color="currentColor"
                  accentColor="#B39445"
                  reach={145}
                  softness={0.8}
                  specks={0}
                  selection={false}
                  labels={false}
                  draggable={false}
                  sweep
                />
              ))}
            </div>
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
              <motion.button
                type="button"
                onClick={goBrowseServices}
                disabled={browseLeaving}
                className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-70"
                whileTap={{ scale: 0.97 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                {t.index.ctaFindPro}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </motion.button>
            </div>

            <div className="mt-8 max-w-xl scroll-mt-28">
              <div className="border border-border bg-card p-3 sm:p-3.5 space-y-2.5" style={{ borderRadius: "10px" }}>
                <label htmlFor="hero-postal" className="text-[12px] font-medium text-muted-foreground">
                  {t.index.heroPostalHint}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="hero-postal"
                    type="text"
                    inputMode="text"
                    autoComplete="postal-code"
                    placeholder={t.index.heroPostalExample}
                    value={postalCode}
                    onChange={(e) => {
                      postalEditedRef.current = true;
                      const next = formatCanadianPostalInput(e.target.value);
                      setPostalCode(next);
                      setPostalResolved(null);
                      setPostalError(null);
                      if (!next.trim()) clearBrowsePostalLocation();
                    }}
                    onFocus={() => {
                      if (!postalCode.trim()) void applyDetectedLocation({ fromEmptyFocus: true });
                    }}
                    onBlur={() => {
                      postalEditedRef.current = false;
                      if (normalizedPostal) void resolvePostal();
                    }}
                    maxLength={7}
                    className={`w-full sm:max-w-[9.5rem] border bg-background px-3 py-2.5 text-sm font-semibold tracking-wide text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 ${postalError ? "border-destructive" : "border-border"}`}
                    style={{ borderRadius: "7px" }}
                    disabled={locating}
                  />
                  <button
                    type="button"
                    onClick={() => void applyDetectedLocation()}
                    disabled={locating || postalLoading}
                    title={t.index.heroPostalUseLocation}
                    aria-label={t.index.heroPostalUseLocation}
                    className="inline-flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    style={{ borderRadius: "7px" }}
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  </button>
                </div>
                {postalResolved ? <p className="px-0.5 text-xs text-muted-foreground">{normalizedPostal}</p> : null}
                {postalLoading || locating ? (
                  <p className="px-0.5 text-xs text-muted-foreground">{t.makeRequest.step3Detecting}</p>
                ) : postalError ? (
                  <p className="px-0.5 text-xs text-destructive">{postalError}</p>
                ) : null}
                {postalResolved ? (
                  <HeroPostalTiltMap
                    lat={postalResolved.lat}
                    lng={postalResolved.lng}
                    className="mt-2"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative mt-6 flex justify-center lg:mt-0 lg:justify-end">
            <BookingPhoneMock alwaysLive />
          </div>
        </div>
        <div className="relative z-20 mx-auto mt-9 w-full max-w-4xl -translate-y-20 lg:-translate-y-[30rem]">
          <form
            id="hero-search"
            onSubmit={handleSubmit}
            className="hero-how-pill relative scale-[0.95] origin-center overflow-hidden rounded-full border border-white/75 bg-white/35 px-5 py-2.5 shadow-[0_20px_70px_rgba(24,27,31,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[30px] backdrop-saturate-150 transition-[background-color,box-shadow,transform] duration-500 hover:bg-white/45 hover:shadow-[0_24px_76px_rgba(24,27,31,0.15),inset_0_1px_0_rgba(255,255,255,0.95)] focus-within:bg-white/50 focus-within:shadow-[0_24px_76px_rgba(24,27,31,0.16),inset_0_1px_0_rgba(255,255,255,1)] dark:border-white/20 dark:bg-white/[0.08] dark:shadow-[0_20px_70px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] dark:hover:bg-white/[0.11] dark:focus-within:bg-white/[0.12]">
            <span className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
              <SpecularButton
                className="h-full w-full pointer-events-none"
                aria-hidden="true"
                tabIndex={-1}
                size="md"
                radius={999}
                tint="#ffffff"
                tintOpacity={0.015}
                textColor="transparent"
                lineColor="#49658A"
                baseColor="#31594D"
                intensity={0.85}
                idleIntensity={0.2}
                shineSize={8}
                shineFade={36}
                thickness={1.1}
                glow={0.7}
                followMouse={false}
                autoAnimate
                speed={0.45}
                proximity={220}
              />
            </span>
            <label htmlFor="hero-need" className="sr-only">{t.index.heroProjectPlaceholder}</label>
            <input
              id="hero-need"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.index.heroProjectPlaceholder}
              className={`relative z-10 min-h-[4.6rem] w-full bg-transparent px-3 py-3 text-center font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/70 ${locale === "fr" ? "text-[clamp(0.86rem,3.8vw,2rem)] sm:text-[2rem]" : "text-[clamp(1.05rem,4.8vw,2rem)] sm:text-[2rem]"} sm:min-h-[5.2rem]`}
              aria-describedby="hero-service-recommendations"
            />
            <button type="submit" className="sr-only">{locale === "fr" ? "Rechercher" : "Search"}</button>
          </form>
          <div id="hero-service-recommendations" aria-live="polite" className="mx-auto mt-4 max-w-4xl">
            {loading && query.trim().length >= 2 ? <p className="text-center text-sm text-muted-foreground">{t.index.heroAiThinking}</p> : null}
            {error && !loading ? <p className="text-center text-sm text-muted-foreground">{t.index.heroAiError}</p> : null}
            {!loading && !error && query.trim().length >= 2 && hasResults ? (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/75 p-3 shadow-lg backdrop-blur-xl">
                {clarifyingMessage ? <p className="w-full text-center text-sm text-muted-foreground">{clarifyingMessage}</p> : null}
                {bestMatch?.serviceName ? (
                  <button type="button" onClick={() => bestMatch.categorySlug && bestMatch.serviceSlug ? goToProsFromSlugs(bestMatch.categorySlug, bestMatch.serviceSlug) : goToService(bestMatch.serviceName!)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">
                    {proOfferedRecords.some((record) => record.name === bestMatch.serviceName && record.slug === bestMatch.serviceSlug && record.categorySlug === bestMatch.categorySlug)
                      ? bestMatch.serviceName
                      : getServiceName(bestMatch.serviceSlug ?? "", locale, bestMatch.serviceName)}<ArrowRight size={15} />
                  </button>
                ) : null}
                {followUpMatches.slice(0, 3).map((item) => (
                  <button key={`${item.categorySlug}/${item.serviceSlug}`} type="button" onClick={() => goToProsFromSlugs(item.categorySlug, item.serviceSlug)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                    {getServiceName(item.serviceSlug, locale, item.serviceName)}<ArrowRight size={14} />
                  </button>
                ))}
                {suggestions.slice(0, 3).map((item, index) => {
                  const service = findServiceByName(item);
                  return (
                    <button key={`${item}-${index}`} type="button" onClick={() => service ? goToProsFromSlugs(service.categorySlug, service.serviceSlug) : goToService(item)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                      {service ? getServiceName(service.serviceSlug, locale, item) : item}<ArrowRight size={14} />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

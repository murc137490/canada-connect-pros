import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { Search, ChevronRight } from "lucide-react";
import ShineBorder from "@/components/ShineBorder";
import MakeRequestButton from "@/components/MakeRequestButton";

export default function Services() {
  const { locale, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const locationFromUrl = searchParams.get("location") || "";
  const [query, setQuery] = useState(initialQuery);

  const allServices = useMemo(() => getAllServices(), []);

  const top5MostSearched = useMemo(() => {
    const slugs = ["plumber", "electrician", "house-cleaning", "hvac-system", "bathroom-remodel"];
    return allServices.filter((s) => slugs.includes(s.slug)).slice(0, 5);
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

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
      <div className="bg-muted/30 border-b border-border/50">
        <div className="container py-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-3xl font-extrabold text-foreground mb-4">
                {t.services.title}
              </h1>
              <div className="relative max-w-xl">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t.services.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-secondary/50"
                />
              </div>
            </div>
            <div className="group flex flex-col items-center lg:items-end gap-2 shrink-0">
              <p className="text-sm text-muted-foreground text-center lg:text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 min-h-[1.25rem]">
                {t.services.receiveResponse}
              </p>
              <MakeRequestButton label={t.services.makeARequest} to="/make-request" />
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
              {filtered.length} {filtered.length === 1 ? t.services.resultsCount : t.services.resultsCountPlural} for &quot;{query}&quot;
            </p>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t.services.noResults}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((s) => (
                  <Link
                    key={`${s.category}-${s.slug}`}
                    to={locationFromUrl ? `/services/${s.categorySlug}/${s.slug}?location=${encodeURIComponent(locationFromUrl)}` : `/services/${s.categorySlug}/${s.slug}`}
                    className="rounded-xl border-2 border-primary/60 bg-card p-4 flex items-center justify-between cursor-pointer hover:border-primary hover:shadow-md transition-all text-foreground dark:text-white dark:border-primary/80 dark:hover:border-primary"
                  >
                    <div>
                      <h3 className="font-medium text-card-foreground dark:text-white">{getServiceName(s.slug, locale, s.name)}</h3>
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
          <div className="space-y-8">
            {top5MostSearched.length > 0 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground dark:text-white mb-4">
                  {t.services.top5MostSearched ?? "Top 5 most searched services"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {top5MostSearched.map((s) => (
                    <ShineBorder key={`${s.categorySlug}-${s.slug}`} className="rounded-xl">
                      <Link
                        to={locationFromUrl ? `/services/${s.categorySlug}/${s.slug}?location=${encodeURIComponent(locationFromUrl)}` : `/services/${s.categorySlug}/${s.slug}`}
                        className="block p-4 rounded-xl bg-card hover:bg-muted/50 border border-border/50 transition-colors text-foreground dark:text-white"
                      >
                        <span className="font-medium">{getServiceName(s.slug, locale, s.name)}</span>
                        <p className="text-xs text-muted-foreground dark:text-white/80 mt-1">
                          {getCategoryName({ name: s.category, slug: s.categorySlug }, locale)}
                        </p>
                      </Link>
                    </ShineBorder>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4">
            {serviceCategories.map((cat) => {
              const totalServices = cat.subcategories.reduce(
                (acc, sub) => acc + sub.services.length,
                0
              );
              return (
                <Link
                  key={cat.slug}
                  to={`/services/${cat.slug}`}
                  className="block rounded-2xl bg-card border border-border hover:bg-muted/40 hover:border-primary/60 transition-colors"
                >
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <h2 className="font-heading font-bold text-lg md:text-xl text-foreground dark:text-white">
                        {getCategoryName(cat, locale)}
                      </h2>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                        {totalServices} {t.services.servicesCount}
                      </span>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-muted-foreground group-hover:text-primary transition-colors"
                    />
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
}

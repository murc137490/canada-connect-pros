import { Link } from "react-router-dom";
import { ArrowUpRight, Home, Sparkles, Trees, Briefcase, Shield, Wrench } from "lucide-react";
import { serviceCategories } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const ICON_BY_SLUG: Record<string, typeof Home> = {
  "home-improvement": Wrench,
  cleaning: Sparkles,
  "outdoor-seasonal": Trees,
  "business-services": Briefcase,
  "security-inspection": Shield,
  "home-services": Home,
};

export default function HomeCategories() {
  const { t, locale } = useLanguage();
  const cats = serviceCategories.slice(0, 8);

  return (
    <section id="categories" className="section-pad border-t border-border/60">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="font-display text-display-md text-foreground tracking-tight">
            {t.index.categoriesTitle}
          </h2>
          <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
            {t.index.categoriesSupport}
          </p>
        </div>

        <div className="mt-10 md:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border/70 rounded-2xl overflow-hidden border border-border/70">
          {cats.map((cat) => {
            const Icon = ICON_BY_SLUG[cat.slug] ?? Home;
            const name = getCategoryName(cat, locale);
            return (
              <Link
                key={cat.slug}
                to={`/services/${cat.slug}`}
                className={cn(
                  "group relative flex flex-col justify-between gap-6 bg-background p-6 md:p-7",
                  "transition-colors duration-300 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.06] text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-muted-foreground opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0"
                    aria-hidden
                  />
                </div>
                <div>
                  <h3 className="font-heading text-base md:text-lg font-semibold text-foreground tracking-tight">
                    {name}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all"
          >
            {t.index.categoriesAll}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

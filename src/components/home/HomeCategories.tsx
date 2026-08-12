import ScrollReveal from "@/components/motion/ScrollReveal";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { serviceCategories } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HomeCategories() {
  const { t, locale } = useLanguage();
  const cats = serviceCategories.slice(0, 8);

  return (
    <section id="categories" className="section-pad">
      <div className="container-page">
        <ScrollReveal y={10}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-display-md text-foreground max-w-[16ch]">
              {t.index.categoriesTitle}
            </h2>
            <Link
              to="/services"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary self-start md:self-auto"
            >
              {t.index.categoriesAll}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="mt-10 -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((cat) => {
            const name = getCategoryName(cat, locale);
            const count = cat.subcategories.reduce((n, s) => n + s.services.length, 0);
            return (
              <Link
                key={cat.slug}
                to={`/services/${cat.slug}`}
                className="snap-start shrink-0 w-[72%] max-w-[280px] border border-border bg-card px-5 py-5 transition-colors duration-200 active:bg-muted/50 hover:border-primary/30"
                style={{ borderRadius: "10px" }}
              >
                <p className="font-heading text-lg font-bold tracking-tight text-foreground">{name}</p>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
                <p className="mt-4 text-xs font-semibold text-primary">{count} services</p>
              </Link>
            );
          })}
        </div>

        <ul className="mt-12 hidden md:block border-t border-border">
          {cats.map((cat, i) => {
            const name = getCategoryName(cat, locale);
            const count = cat.subcategories.reduce((n, s) => n + s.services.length, 0);
            return (
              <li key={cat.slug} className="border-b border-border">
                <Link
                  to={`/services/${cat.slug}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-6 py-5 transition-colors duration-200 hover:bg-muted/30 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] lg:gap-10 lg:px-2"
                >
                  <span className="font-heading text-xl font-bold tracking-tight text-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary">
                    {name}
                  </span>
                  <span className="hidden text-sm text-muted-foreground leading-relaxed lg:block">
                    {cat.description}
                  </span>
                  <span className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">{count}</span>
                    <ArrowUpRight className="h-4 w-4 text-foreground/40 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

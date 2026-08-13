import { useParams, Link } from "react-router-dom";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import Layout from "@/components/Layout";
import { serviceCategories } from "@/data/services";
import { getCategoryVisual } from "@/data/categoryVisuals";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getSubcategoryName, getServiceName } from "@/i18n/serviceTranslations";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import CategoryLottie from "@/components/CategoryLottie";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t } = useLanguage();
  const category = serviceCategories.find((c) => c.slug === slug);
  const visual = getCategoryVisual(slug ?? "");

  useScrollRestore(slug ? `premiere:scroll:/services/${slug}` : "premiere:scroll:/services/category");

  if (!category) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading mb-4 text-2xl font-bold text-foreground">{t.services.categoryNotFound}</h1>
          <Button asChild>
            <Link to="/services">{t.services.backToServices}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const totalServices = category.subcategories.reduce((a, s) => a + s.services.length, 0);
  const name = getCategoryName(category, locale);
  const blurb = locale === "fr" ? visual.blurbFr : visual.blurbEn;
  const alt = locale === "fr" ? visual.imageAltFr : visual.imageAltEn;

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img
            src={visual.image}
            srcSet={visual.imageSrcSet}
            sizes="100vw"
            alt=""
            className="h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, ${visual.accent}f2 0%, ${visual.accent}cc 38%, rgba(0,0,0,0.55) 100%)`,
            }}
          />
        </div>

        <div className="container relative z-10 py-12 md:py-16">
          <Link
            to="/services"
            className="mb-5 inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} />
            {t.services.backToServices}
          </Link>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                {totalServices} {t.services.servicesCount}
              </p>
              <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                {name}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-white/85 md:text-lg">{blurb}</p>
            </div>

            {visual.lottie ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-white/95 p-2 shadow-lg md:h-32 md:w-32"
              >
                <CategoryLottie src={visual.lottie} play className="h-full w-full" />
              </motion.div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="bg-background">
        <div className="container space-y-10 py-10 md:py-14">
          {category.subcategories.map((sub, subIndex) => (
            <motion.section
              key={sub.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: Math.min(subIndex * 0.08, 0.24) }}
            >
              <h2 className="mb-4 font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {getSubcategoryName(category.slug, sub.name, locale)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sub.services.map((svc) => (
                  <motion.div
                    key={svc.slug}
                    whileHover={{ y: -3 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  >
                    <Link
                      to={`/services/${category.slug}/${svc.slug}/pros`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:border-secondary/50 hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <span className="block font-medium text-card-foreground">
                          {getServiceName(svc.slug, locale, svc.name)}
                        </span>
                      </div>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors group-hover:bg-secondary group-hover:text-secondary-foreground"
                        style={{ background: `${visual.accent}18`, color: visual.accent }}
                      >
                        <ChevronRight size={16} />
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </div>

      {/* preload alt text for a11y without visible img duplication */}
      <span className="sr-only">{alt}</span>
    </Layout>
  );
}

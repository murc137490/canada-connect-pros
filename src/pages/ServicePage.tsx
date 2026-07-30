import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { getCategoryVisual } from "@/data/categoryVisuals";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getSubcategoryName, getServiceName } from "@/i18n/serviceTranslations";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import CategoryLottie from "@/components/CategoryLottie";

export default function ServicePage() {
  const { categorySlug, serviceSlug } = useParams<{ categorySlug: string; serviceSlug: string }>();
  const { locale, t } = useLanguage();
  const category = serviceCategories.find((c) => c.slug === categorySlug);
  const allServices = getAllServices();
  const service = allServices.find(
    (s) => s.slug === serviceSlug && s.categorySlug === categorySlug
  );
  const visual = getCategoryVisual(categorySlug ?? "");

  if (!category || !service) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading mb-4 text-2xl font-bold text-foreground">{t.services.serviceNotFound}</h1>
          <Button asChild>
            <Link to="/services">{t.services.backToServices}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const serviceName = getServiceName(service.slug, locale, service.name);
  const categoryName = getCategoryName(category, locale);

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
              background: `linear-gradient(115deg, ${visual.accent}f2 0%, ${visual.accent}b8 45%, rgba(0,0,0,0.6) 100%)`,
            }}
          />
        </div>

        <div className="container relative z-10 py-12 md:py-16">
          <Link
            to={`/services/${category.slug}`}
            className="mb-5 inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} />
            {categoryName}
          </Link>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                {categoryName} · {getSubcategoryName(category.slug, service.subcategory, locale)}
              </p>
              <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                {serviceName}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
                {t.services.serviceHeroSupport.replace("{service}", serviceName.toLowerCase())}
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-white/95 p-2 shadow-lg md:h-32 md:w-32"
            >
              <CategoryLottie
                src={visual.lottie ?? "/lottie/search.json"}
                play
                className="h-full w-full"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="bg-background">
        <div className="container max-w-3xl space-y-6 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-border bg-card p-7 shadow-sm md:p-9"
          >
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t.services.findServiceProsTitle.replace("{service}", serviceName)}
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {t.services.findServiceProsDesc.replace("{service}", serviceName.toLowerCase())}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
              <Button
                size="lg"
                className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                asChild
              >
                <Link to={`/services/${category.slug}/${service.slug}/pros`}>
                  {t.services.viewAvailablePros} <ArrowRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/make-request">{t.services.makeARequest}</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 }}
            whileHover={{ y: -2 }}
            className="rounded-3xl border border-border bg-card p-7 shadow-sm md:p-9"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={20} className="text-secondary" />
              <h3 className="font-heading text-lg font-bold text-foreground">
                {(t.services.areYouServicePro ?? "Are you a {service} professional?").replace(
                  "{service}",
                  serviceName
                )}
              </h3>
            </div>
            <p className="mb-5 text-muted-foreground leading-relaxed">
              {t.services.ctaThatCouldBeYou ??
                "That could be you here! Join our growing network of Canadian service pros and start getting leads today."}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                asChild
              >
                <Link to="/join-pros">
                  {t.joinPros?.becomePro ?? "Become a Pro"} <ArrowRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth?mode=signup">{t.auth?.createAccount ?? "Create an Account"}</Link>
              </Button>
            </div>
          </motion.div>

          <div className="text-center">
            <Button variant="ghost" asChild>
              <Link to={`/services/${category.slug}`} className="gap-2">
                <ArrowLeft size={16} /> {t.services.backTo} {categoryName}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

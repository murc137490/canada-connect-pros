import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { serviceCategories } from "@/data/services";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getSubcategoryName, getServiceName } from "@/i18n/serviceTranslations";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLanguage();
  const category = serviceCategories.find((c) => c.slug === slug);

  if (!category) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Category not found</h1>
          <Button asChild>
            <Link to="/services">Back to Services</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const totalServices = category.subcategories.reduce((a, s) => a + s.services.length, 0);

  return (
    <Layout>
      <div className="bg-primary text-primary-foreground">
        <div className="container py-12">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-4">
            <ArrowLeft size={16} />
            All Services
          </Link>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2">{getCategoryName(category, locale)}</h1>
          <p className="text-primary-foreground/70 text-lg">{category.description}</p>
          <p className="text-sm text-primary-foreground/50 mt-2">{totalServices} services available</p>
        </div>
      </div>

      <div className="container py-10 space-y-6">
        {category.subcategories.map((sub) => (
          <div key={sub.name} className="subservice-tab p-5 md:p-6">
            <h2 className="font-heading font-bold text-xl text-foreground mb-4">{getSubcategoryName(category.slug, sub.name, locale)}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sub.services.map((svc) => (
                <Link
                  key={svc.slug}
                  to={`/services/${category.slug}/${svc.slug}/pros`}
                  className="subservice-tab-inner flex items-center justify-between p-4 cursor-pointer group"
                >
                  <span className="text-card-foreground font-medium">{getServiceName(svc.slug, locale, svc.name)}</span>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground group-hover:text-secondary transition-colors shrink-0"
                  />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

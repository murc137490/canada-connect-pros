import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import {
  TERMS_FULL_SECTIONS,
  TERMS_FULL_SECTIONS_FR,
  TERMS_PROVIDER_AGREEMENT,
  TERMS_PROVIDER_AGREEMENT_FR,
  LAST_UPDATED,
  LAST_UPDATED_FR,
  COMPANY_NAME,
} from "@/content/termsContent";
import { SERVICE_RESOLUTION_HELP } from "@/config/legalConfig";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Shield } from "lucide-react";

export default function TermsOfService() {
  const { t, locale } = useLanguage();
  const fullSections = locale === "fr" ? TERMS_FULL_SECTIONS_FR : TERMS_FULL_SECTIONS;
  const providerAgreement = locale === "fr" ? TERMS_PROVIDER_AGREEMENT_FR : TERMS_PROVIDER_AGREEMENT;
  const lastUpdated = locale === "fr" ? LAST_UPDATED_FR : LAST_UPDATED;
  const help = locale === "fr" ? SERVICE_RESOLUTION_HELP.fr : SERVICE_RESOLUTION_HELP.en;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <div className="container py-10 md:py-16 px-4 md:px-6 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft size={16} /> {t.terms.backToHome}
          </Link>

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            {t.terms.fullTitle}
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            {t.terms.lastUpdated}: {lastUpdated}
          </p>

          <div className="rounded-xl border bg-card p-6 md:p-8 mb-10 space-y-4">
            <div className="flex gap-3 items-start">
              <Shield size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">{help.title}</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{help.short}</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{help.body}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  {locale === "fr"
                    ? "Libellé final soumis à révision juridique. Voir aussi "
                    : "Final wording subject to legal review. See also "}
                  <Link to="/privacy" className="underline">
                    {locale === "fr" ? "Confidentialité" : "Privacy"}
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
            {fullSections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
                  {section.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.body}
                </p>
              </section>
            ))}

            <hr className="border-border my-12" />

            <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
              {t.terms.providerAgreementTitle}
            </h2>
            {providerAgreement.map((section) => (
              <section key={section.title} className="mb-8">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
                  {section.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            {COMPANY_NAME}. {t.terms.governingLaw}
          </p>
        </div>
      </div>
    </Layout>
  );
}

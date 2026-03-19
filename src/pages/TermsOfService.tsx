import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import {
  TERMS_FULL_SECTIONS,
  TERMS_PROVIDER_AGREEMENT,
  LAST_UPDATED,
  COMPANY_NAME,
} from "@/content/termsContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, RefreshCw, Shield, UserCheck } from "lucide-react";

export default function TermsOfService() {
  const { t } = useLanguage();

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
            {t.terms.lastUpdated}: {LAST_UPDATED}
          </p>

          {/* Booking Guarantee at the top */}
          <div className="rounded-xl border bg-card p-6 md:p-8 mb-10 space-y-6">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {t.guarantee.title}
            </h2>
            <ul className="space-y-4 list-none p-0 m-0">
              <li className="flex gap-3">
                <RefreshCw size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">{t.guarantee.rebooking}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.guarantee.rebookingDesc}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Shield size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">{t.guarantee.quality}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.guarantee.qualityDesc}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <UserCheck size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">{t.guarantee.replacement}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.guarantee.replacementDesc}</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
            {TERMS_FULL_SECTIONS.map((section) => (
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
            {TERMS_PROVIDER_AGREEMENT.map((section) => (
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
            {COMPANY_NAME}. {t.terms.governingLaw}.
          </p>
        </div>
      </div>
    </Layout>
  );
}

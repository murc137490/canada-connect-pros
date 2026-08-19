import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft } from "lucide-react";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_LAST_UPDATED_FR,
  PRIVACY_SECTIONS_EN,
  PRIVACY_SECTIONS_FR,
  PRIVACY_VERSION,
} from "@/content/privacyContent";
import { LEGAL_DOCUMENT_VERSIONS } from "@/config/legalConfig";

export default function PrivacyPolicy() {
  const { locale, t } = useLanguage();
  const sections = locale === "fr" ? PRIVACY_SECTIONS_FR : PRIVACY_SECTIONS_EN;
  const lastUpdated = locale === "fr" ? PRIVACY_LAST_UPDATED_FR : PRIVACY_LAST_UPDATED;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <div className="container py-10 md:py-16 px-4 md:px-6 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft size={16} /> {t.terms?.backToHome ?? "Back"}
          </Link>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            {locale === "fr" ? "Politique de confidentialité" : "Privacy Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            {locale === "fr" ? "Dernière mise à jour" : "Last updated"}: {lastUpdated}
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            {locale === "fr" ? "Version" : "Version"}: {PRIVACY_VERSION} (
            {LEGAL_DOCUMENT_VERSIONS.privacy_policy.hash}) — draft pending legal review
          </p>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-2">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{section.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-10 text-sm text-muted-foreground">
            <Link to="/cookies" className="underline underline-offset-2">
              {locale === "fr" ? "Politique relative aux témoins" : "Cookie Policy"}
            </Link>
            {" · "}
            <Link to="/terms" className="underline underline-offset-2">
              {locale === "fr" ? "Conditions" : "Terms"}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}

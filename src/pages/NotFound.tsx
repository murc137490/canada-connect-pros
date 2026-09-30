import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import FuzzyText from "@/components/FuzzyText";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { applyDocumentMeta, notFoundMeta } from "@/lib/routeMeta";

const NotFound = () => {
  const { locale } = useLanguage();
  const { pathname } = useLocation();
  const fr = locale === "fr";

  useEffect(() => {
    applyDocumentMeta(notFoundMeta(locale, pathname), locale);
    const existing = document.querySelector('meta[name="robots"]');
    const prev = existing?.getAttribute("content") ?? null;
    let meta = existing as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex";
    return () => {
      if (!meta) return;
      if (prev == null) meta.remove();
      else meta.content = prev;
    };
  }, [locale, pathname]);

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center px-4">
          <FuzzyText
            baseIntensity={0.2}
            hoverIntensity={0.5}
            enableHover
            color="hsl(var(--primary))"
            fontSize="clamp(3rem, 15vw, 8rem)"
            className="block mx-auto mb-6"
          >
            404
          </FuzzyText>
          <h1 className="mb-6 text-xl text-muted-foreground">
            {fr ? "Cette page n'existe pas." : "This page doesn't exist."}
          </h1>
          <Link to="/" className="text-primary underline hover:text-primary/90 font-medium">
            {fr ? "Retour à l'accueil" : "Back to home"}
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;

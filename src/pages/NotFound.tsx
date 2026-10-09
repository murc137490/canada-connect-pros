import { Link } from "react-router-dom";
import FuzzyText from "@/components/FuzzyText";
import Layout from "@/components/Layout";
import PrivateNoIndex from "@/components/PrivateNoIndex";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  /** Set when the URL looked like a public handle (/<username>) that nobody owns. */
  handle?: string;
};

const NotFound = ({ handle }: Props) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const fr = locale === "fr";

  const title = handle
    ? fr
      ? `Aucun profil à l’adresse /${handle}`
      : `No profile lives at /${handle}`
    : fr
      ? "Page introuvable"
      : "Page not found";
  const body = handle
    ? fr
      ? "Ce lien a peut-être changé ou n’existe plus. Cherchez le pro par service, ou demandez-lui son nouveau lien."
      : "This link may have changed or no longer exists. Look the pro up by service, or ask them for their new link."
    : fr
      ? "Le lien est peut-être erroné ou la page a été déplacée."
      : "The link may be wrong or the page may have moved.";

  return (
    <Layout>
      <PrivateNoIndex />
      <div className="flex min-h-[70vh] items-center justify-center bg-muted/40">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
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
          <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-3 text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/services">{fr ? "Trouver un pro" : "Find a pro"}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={user ? "/dashboard" : "/"}>
                {user ? (fr ? "Mon tableau de bord" : "My dashboard") : fr ? "Retour à l’accueil" : "Back to home"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;

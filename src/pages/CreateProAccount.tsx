import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProProfileEditorDialog } from "@/components/pro/ProProfileEditorDialog";

/** Deep-link fallback: opens the same pro profile editor dialog (onboarding / promo flows). */
export default function CreateProAccount() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  if (!user) {
    return (
      <Layout>
        <div className="container py-12 px-4 text-center">
          <p className="text-muted-foreground mb-4">{t.joinPros.loginMessage}</p>
          <Button asChild>
            <Link to="/auth?mode=login&redirect=/create-pro-account">{t.nav.logIn}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProProfileEditorDialog
        open
        allowDirectCreate={onboarding}
        onOpenChange={(open) => {
          if (open) return;
          navigate(onboarding ? "/join-pros" : "/dashboard", { replace: true });
        }}
      />
    </Layout>
  );
}

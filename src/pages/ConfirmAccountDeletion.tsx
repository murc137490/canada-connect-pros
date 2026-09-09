import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, AlertTriangle, Loader2, Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfirmAccountDeletion() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { locale } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage(
        locale === "fr"
          ? "Aucun jeton de confirmation fourni dans le lien."
          : "No confirmation token provided in the link."
      );
      return;
    }

    let cancelled = false;

    async function confirmToken() {
      try {
        const { data, error } = await supabase.functions.invoke("account-deletion", {
          body: { action: "confirm", token },
        });

        if (cancelled) return;

        if (error || !data?.ok) {
          setErrorMessage(
            data?.error ||
              error?.message ||
              (locale === "fr"
                ? "Le jeton de confirmation est invalide ou a expiré."
                : "The confirmation token is invalid or has expired.")
          );
          setSuccess(false);
        } else {
          setSuccess(true);
          setScheduledAt(data.scheduled_delete_at);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : locale === "fr"
              ? "Une erreur inattendue est survenue."
              : "An unexpected error occurred."
          );
          setSuccess(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void confirmToken();

    return () => {
      cancelled = true;
    };
  }, [token, locale]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
            P
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {locale === "fr" ? "Vérification en cours..." : "Verifying request..."}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "fr"
                ? "Validation du jeton de suppression sécurisé..."
                : "Validating secure account deletion token..."}
            </p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {locale === "fr" ? "Suppression programmée" : "Account Deletion Scheduled"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {locale === "fr" ? (
                <>
                  Votre demande de suppression a été confirmée. Conformément à la Loi 25 du Québec, toutes vos données
                  personnelles, profils et photos seront <strong>définitivement supprimés dans 24 heures</strong>
                  {scheduledAt ? ` (le ${new Date(scheduledAt).toLocaleString("fr-CA")})` : ""}.
                </>
              ) : (
                <>
                  Your deletion request has been confirmed. In accordance with Quebec's Law 25, all your personal data,
                  profile, and uploaded documents will be <strong>permanently deleted in 24 hours</strong>
                  {scheduledAt ? ` (on ${new Date(scheduledAt).toLocaleString("en-CA")})` : ""}.
                </>
              )}
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-muted-foreground text-left space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                {locale === "fr" ? "Période de grâce de 24h" : "24-hour grace period"}
              </p>
              <p>
                {locale === "fr"
                  ? "Si vous changez d'avis avant l'échéance, connectez-vous à votre tableau de bord pour annuler la demande."
                  : "If you change your mind before the window closes, log into your dashboard to cancel the request."}
              </p>
            </div>

            <div className="pt-2">
              <Button asChild className="w-full">
                <Link to="/">{locale === "fr" ? "Retour à l'accueil" : "Return to Home"}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {locale === "fr" ? "Lien invalide ou expiré" : "Invalid or Expired Link"}
            </h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard">{locale === "fr" ? "Accéder au tableau de bord" : "Go to Dashboard"}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

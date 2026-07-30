import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { referralInvite } from "@/lib/referralInvite";
import { normalizePromotionalInput } from "@/lib/promoCodeInput";
import { Loader2 } from "lucide-react";

export default function ProOnboardingStart() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [promoNote, setPromoNote] = useState("");
  const [lastConfirmedCode, setLastConfirmedCode] = useState<string | null>(null);
  const [lastConfirmedTrialToken, setLastConfirmedTrialToken] = useState<string | null>(null);

  const trimmedPromo = promoCode.trim();
  const hasPromoInput = trimmedPromo.length > 0;
  const promoConfirmedOk =
    !hasPromoInput || (promoStatus === "valid" && (lastConfirmedCode === trimmedPromo || lastConfirmedTrialToken !== null));

  const confirmPromo = async () => {
    if (!trimmedPromo) {
      setPromoStatus("idle");
      setPromoNote("");
      setLastConfirmedCode(null);
      setLastConfirmedTrialToken(null);
      return;
    }
    setPromoStatus("checking");
    setPromoNote("");
    setLastConfirmedCode(null);
    setLastConfirmedTrialToken(null);

    const codeForApi = normalizePromotionalInput(trimmedPromo);
    const { data, error } = await referralInvite("validate_code", { code: codeForApi || trimmedPromo });
    if (error || !data?.valid) {
      setPromoStatus("invalid");
      setPromoNote(error?.message ?? (locale === "fr" ? "Code promotionnel invalide." : "Promotional code is invalid."));
      return;
    }

    const days = Number(data.reward_days ?? 14);
    const planLabel = t.plans?.growth ?? "Growth";
    const acceptedMsg = (t.createPro?.promoCodeAcceptedOnTier ?? "Code accepted ({{days}} days on {{plan}}).")
      .replace("{{days}}", String(days))
      .replace("{{plan}}", planLabel);

    if (data.code_kind === "personal_trial" && data.trial_token) {
      setPromoStatus("valid");
      setLastConfirmedTrialToken(data.trial_token);
      setPromoNote(
        locale === "fr"
          ? `${acceptedMsg} Vous compléterez l’activation sur la page d’essai après la création du profil.`
          : `${acceptedMsg} You will finish activation on the trial page after creating your profile.`,
      );
      return;
    }

    setPromoStatus("valid");
    setLastConfirmedCode(codeForApi || trimmedPromo);
    setPromoNote(acceptedMsg);
  };

  const goNext = () => {
    const qs = new URLSearchParams();
    qs.set("onboarding", "1");
    if (lastConfirmedTrialToken) {
      qs.set("trial_token", lastConfirmedTrialToken);
    } else if (trimmedPromo && lastConfirmedCode) {
      const code = normalizePromotionalInput(trimmedPromo) || trimmedPromo;
      qs.set("promo_code", code);
    }
    navigateWithViewTransition(navigate, `/create-pro-account?${qs.toString()}`);
  };

  if (!user) {
    return (
      <Layout>
        <div className="container py-12 px-4 text-center">
          <p className="text-muted-foreground mb-4">Please log in first.</p>
          <Button asChild>
            <Link to="/auth?mode=login&redirect=/pro-onboarding/start">{locale === "fr" ? "Connexion" : "Log in"}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <div className="container max-w-xl py-14 px-4">
          <h1 className="font-heading text-3xl font-bold text-foreground">{locale === "fr" ? "Créez votre compte pro" : "Create your pro account"}</h1>
          <p className="text-muted-foreground mt-2">
            {locale === "fr" ? "Continuez en deux étapes rapides." : "Continue setup in two quick steps."}
          </p>
          <div className="mt-8 rounded-xl border bg-card p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promo-code">{locale === "fr" ? "Code promotionnel" : "Promotional code"}</Label>
              <Input
                id="promo-code"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoStatus("idle");
                  setPromoNote("");
                  setLastConfirmedCode(null);
                  setLastConfirmedTrialToken(null);
                }}
                placeholder={
                  locale === "fr"
                    ? "Code ou lien d’essai (ex. …/trial?token=…)"
                    : "Code or trial link (e.g. …/trial?token=…)"
                }
              />
              {hasPromoInput ? (
                <p
                  className={`text-sm ${
                    promoStatus === "valid" ? "text-emerald-600 dark:text-emerald-400" : promoStatus === "invalid" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {promoStatus === "checking" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {locale === "fr" ? "Vérification…" : "Checking…"}
                    </span>
                  ) : (
                    promoNote
                  )}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {hasPromoInput ? (
                <Button type="button" variant="secondary" onClick={() => void confirmPromo()} disabled={promoStatus === "checking"}>
                  {promoStatus === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : locale === "fr" ? (
                    "Confirmer le code"
                  ) : (
                    "Confirm code"
                  )}
                </Button>
              ) : null}
              <Button type="button" onClick={goNext} disabled={hasPromoInput && !promoConfirmedOk}>
                {locale === "fr" ? "Terminé" : "Done"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import MagicCard from "@/components/MagicCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StrengthLevel = "empty" | "weak" | "medium" | "strong";

function passwordStrength(password: string): {
  level: StrengthLevel;
  label: string;
  labelFr: string;
  color: string;
  entropy: number;
  poolSize: number;
  percent: number;
} {
  if (!password) {
    return {
      level: "empty",
      label: "Enter a password",
      labelFr: "Entrez un mot de passe",
      color: "bg-muted",
      entropy: 0,
      poolSize: 0,
      percent: 8,
    };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const poolSize =
    (hasLower ? 26 : 0) +
    (hasUpper ? 26 : 0) +
    (hasNumber ? 10 : 0) +
    (hasSpecial ? 33 : 0);
  const entropy = poolSize > 0 ? password.length * Math.log2(poolSize) : 0;
  const percent = Math.min(100, Math.max(8, Math.round((entropy / 80) * 100)));

  if (entropy < 45) {
    return { level: "weak", label: "Weak", labelFr: "Faible", color: "bg-red-500", entropy, poolSize, percent };
  }
  if (entropy < 70) {
    return { level: "medium", label: "Medium", labelFr: "Moyen", color: "bg-yellow-500", entropy, poolSize, percent };
  }
  return { level: "strong", label: "Strong", labelFr: "Fort", color: "bg-green-500", entropy, poolSize, percent };
}

export default function ResetPassword() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const fr = locale === "fr";
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    let cancelled = false;

    const acceptRecoverySession = async () => {
      setCheckingSession(true);
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setHasRecoverySession(!!session);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    void acceptRecoverySession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecoverySession(!!session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (strength.level !== "strong") {
      toast({
        title: fr ? "Mot de passe trop faible" : "Password too weak",
        description: fr
          ? "Utilisez au moins 12 caractères avec majuscules, minuscules, chiffres et symbole."
          : "Use at least 12 characters with uppercase, lowercase, numbers, and a symbol.",
        variant: "destructive",
      });
      return;
    }
    if (!passwordsMatch) {
      toast({
        title: fr ? "Les mots de passe ne correspondent pas" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast({
        title: fr ? "Mot de passe mis à jour" : "Password updated",
        description: fr ? "Vous pouvez maintenant vous connecter." : "You can now sign in.",
      });
    } catch (error) {
      toast({
        title: fr ? "Erreur" : "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-10 md:py-16">
        <div className="w-full max-w-md">
          <MagicCard className="p-0">
            <Card className="border-none bg-transparent shadow-none">
              <CardHeader>
                <Link to="/auth?mode=login" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft size={16} /> {fr ? "Retour à la connexion" : "Back to login"}
                </Link>
                <CardTitle className="font-heading text-2xl">
                  {fr ? "Créer un nouveau mot de passe" : "Create a new password"}
                </CardTitle>
                <CardDescription>
                  {fr
                    ? "Entrez votre nouveau mot de passe deux fois pour confirmer le changement."
                    : "Enter your new password twice to confirm the change."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checkingSession ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                  </div>
                ) : done ? (
                  <div className="space-y-5 text-center">
                    <CheckCircle2 className="mx-auto size-12 text-green-600" />
                    <p className="text-sm text-muted-foreground">
                      {fr ? "Votre mot de passe a été modifié avec succès." : "Your password was changed successfully."}
                    </p>
                    <Button className="w-full" onClick={() => navigate("/auth?mode=login")}>
                      {fr ? "Se connecter" : "Sign in"}
                    </Button>
                  </div>
                ) : !hasRecoverySession ? (
                  <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      {fr ? "Lien de réinitialisation requis" : "Reset link required"}
                    </p>
                    <p className="text-muted-foreground">
                      {fr
                        ? "Ouvrez cette page à partir du lien reçu par courriel. Si le lien a expiré, demandez un nouveau courriel."
                        : "Open this page from the link sent to your email. If it expired, request a new email."}
                    </p>
                    <Button asChild className="w-full">
                      <Link to="/auth?mode=login">{fr ? "Demander un nouveau lien" : "Request a new link"}</Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{fr ? "Nouveau mot de passe" : "New password"}</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          className="pr-10"
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", strength.color)}
                            style={{ width: `${strength.percent}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fr ? "Sécurité du mot de passe" : "Password strength"}:{" "}
                          <span className="font-medium text-foreground">{fr ? strength.labelFr : strength.label}</span>
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {fr
                            ? "Pour un mot de passe plus fort, utilisez des lettres minuscules et majuscules, des chiffres et des caractères spéciaux."
                            : "For a stronger password, use lowercase and uppercase letters, numbers, and special characters."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{fr ? "Confirmer le mot de passe" : "Confirm password"}</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className="pr-10"
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {confirmPassword ? (
                        <p className={cn("text-xs", passwordsMatch ? "text-green-600" : "text-destructive")}>
                          {passwordsMatch
                            ? fr
                              ? "Les mots de passe correspondent."
                              : "Passwords match."
                            : fr
                              ? "Les mots de passe ne correspondent pas."
                              : "Passwords do not match."}
                        </p>
                      ) : null}
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={saving}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                      {fr ? "Mettre à jour le mot de passe" : "Update password"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
}

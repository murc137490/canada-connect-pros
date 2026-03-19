import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MagicCard from "@/components/MagicCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth, NAME_TAKEN_MESSAGE, EMAIL_ALREADY_IN_USE_MESSAGE } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirect = searchParams.get("redirect") || "/";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailLanguage, setEmailLanguage] = useState<"en" | "fr">("en");
  const [loading, setLoading] = useState(false);
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const modeFromUrl = searchParams.get("mode") === "signup" ? "signup" : "login";
    setMode(modeFromUrl);
  }, [searchParams]);

  const isEmailAlreadyRegistered = (msg: string) => {
    const m = msg.toLowerCase();
    return m.includes("already registered") || m.includes("user already exists") || m.includes("already been registered") || m.includes("email already");
  };

  function nameSuggestions(name: string): string[] {
    const trimmed = name.trim();
    if (!trimmed) return [];
    const slug = trimmed.toLowerCase().replace(/\s+/g, "");
    const suggestions: string[] = [];
    for (let i = 1; i <= 3; i++) suggestions.push(`${trimmed} ${i}`);
    suggestions.push(`${slug}48`, `${slug}99`);
    return suggestions;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailAlreadyExists(false);
    setNameTaken(false);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          emailLanguage,
        });
        toast({ title: t.auth.toastCreated });
      } else {
        await signIn(email.trim(), password);
        toast({ title: t.auth.toastWelcome });
        navigate(redirect);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (mode === "signup" && (msg === EMAIL_ALREADY_IN_USE_MESSAGE || isEmailAlreadyRegistered(msg))) {
        setEmailAlreadyExists(true);
      } else if (mode === "signup" && msg === NAME_TAKEN_MESSAGE) {
        setNameTaken(true);
      } else {
        toast({ title: t.auth.toastError, description: msg === EMAIL_ALREADY_IN_USE_MESSAGE ? t.auth.emailAlreadyExists : msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const setModeLogin = () => { setMode("login"); setEmailAlreadyExists(false); setNameTaken(false); navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirect)}`, { replace: true }); };
  const setModeSignup = () => { setMode("signup"); setEmailAlreadyExists(false); setNameTaken(false); navigate(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`, { replace: true }); };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-10 md:py-16 px-4">
        <div className="w-full max-w-md space-y-6 md:space-y-8">
          <MagicCard className="p-0">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="space-y-1 pb-2">
                <div className="flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={setModeLogin}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "login" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.auth.logIn}
            </button>
            <button
              type="button"
              onClick={setModeSignup}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.auth.signUpLink}
            </button>
          </div>
                <CardTitle className="text-center pt-2 font-heading text-2xl">
                  {mode === "login" ? t.auth.welcomeBack : t.auth.createAccount}
                </CardTitle>
                <CardDescription className="text-center">
                  {mode === "login" ? t.auth.loginSubtitle : t.auth.signupSubtitle}
                </CardDescription>
              </CardHeader>
              <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground dark:text-white">{t.auth.fullName} *</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder={t.auth.placeholderName}
                    className="mt-1.5 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60 bg-background dark:bg-card"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground dark:text-white">{t.auth.email} *</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t.auth.placeholderEmail}
                    className="mt-1.5 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60 bg-background dark:bg-card"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailLang">{t.auth.emailLanguageLabel}</Label>
                  <select
                    id="emailLang"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={emailLanguage}
                    onChange={(e) => setEmailLanguage(e.target.value === "fr" ? "fr" : "en")}
                  >
                    <option value="en">{t.auth.emailLanguageEn}</option>
                    <option value="fr">{t.auth.emailLanguageFr}</option>
                  </select>
                  {t.auth.emailLanguageHint && (
                    <p className="text-xs text-muted-foreground">{t.auth.emailLanguageHint}</p>
                  )}
                </div>
              </>
            )}
            {mode === "login" && (
              <div className="space-y-2">
                <Label htmlFor="emailOrName" className="text-foreground dark:text-white">{t.auth.emailOrName}</Label>
                <Input
                  id="emailOrName"
                  type="text"
                  autoComplete="username"
                  placeholder={t.auth.emailOrNamePlaceholder}
                  className="mt-1.5 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60 bg-background dark:bg-card"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground dark:text-white">{t.auth.password}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.auth.placeholderPassword}
                  className="text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60 bg-background dark:bg-card"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {emailAlreadyExists && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{t.auth.emailAlreadyExists}</p>
                <p className="text-sm text-muted-foreground">{t.auth.emailAlreadyExistsPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setMode("login");
                      setEmailAlreadyExists(false);
                    }}
                  >
                    {t.auth.logIn}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmailAlreadyExists(false);
                      setEmail("");
                    }}
                  >
                    {t.auth.useDifferentEmail}
                  </Button>
                </div>
              </div>
            )}

            {nameTaken && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{t.auth.nameTaken}</p>
                <p className="text-xs text-muted-foreground">{t.auth.nameTakenSuggestions}</p>
                <div className="flex flex-wrap gap-2">
                  {nameSuggestions(fullName).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="text-sm px-3 py-1.5 rounded-md bg-background border border-input hover:bg-muted"
                      onClick={() => {
                        setFullName(suggestion);
                        setNameTaken(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
              size="lg"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "login" ? t.auth.logIn : t.auth.createAccountButton}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed text-center">
                  {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
                  <button
                    type="button"
                    onClick={mode === "login" ? setModeSignup : setModeLogin}
                    className="text-secondary font-medium hover:underline"
                  >
                    {mode === "login" ? t.auth.signUpLink : t.auth.logInLink}
                  </button>
                </p>
              </CardFooter>
            </Card>
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
}

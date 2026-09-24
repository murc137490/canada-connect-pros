import { Link, Navigate, useParams } from "react-router-dom";
import { Smartphone, Share, MoreVertical, Plus, Check } from "lucide-react";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Platform = "android" | "ios";

function isPlatform(v: string | undefined): v is Platform {
  return v === "android" || v === "ios";
}

export default function GetAppGuide() {
  const { platform } = useParams<{ platform: string }>();
  const { locale } = useLanguage();
  const fr = locale === "fr";

  if (!isPlatform(platform)) {
    return <Navigate to="/get-app/android" replace />;
  }

  const isIos = platform === "ios";
  const steps = isIos
    ? fr
      ? [
          { icon: Smartphone, title: "Ouvrez Safari", body: "Allez sur www.altshift.ca dans Safari (pas Chrome)." },
          { icon: Share, title: "Touchez Partager", body: "L’icône carré avec une flèche vers le haut, en bas de l’écran." },
          { icon: Plus, title: "Sur l’écran d’accueil", body: "Faites défiler et touchez « Sur l’écran d’accueil »." },
          { icon: Check, title: "Ajoutez", body: "Touchez « Ajouter ». L’icône AltShift apparaît comme une app." },
        ]
      : [
          { icon: Smartphone, title: "Open Safari", body: "Go to www.altshift.ca in Safari (not Chrome)." },
          { icon: Share, title: "Tap Share", body: "The square with an arrow pointing up, at the bottom of the screen." },
          { icon: Plus, title: "Add to Home Screen", body: "Scroll and tap “Add to Home Screen”." },
          { icon: Check, title: "Add", body: "Tap “Add”. The AltShift icon appears like an app." },
        ]
    : fr
      ? [
          { icon: Smartphone, title: "Ouvrez Chrome", body: "Allez sur www.altshift.ca dans Chrome sur Android." },
          { icon: MoreVertical, title: "Menu ⋮", body: "Touchez les trois points en haut à droite." },
          { icon: Plus, title: "Installer l’app", body: "Touchez « Installer l’application » ou « Ajouter à l’écran d’accueil »." },
          { icon: Check, title: "Confirmez", body: "Touchez « Installer » / « Ajouter ». AltShift s’ouvre comme une app." },
        ]
      : [
          { icon: Smartphone, title: "Open Chrome", body: "Go to www.altshift.ca in Chrome on Android." },
          { icon: MoreVertical, title: "Menu ⋮", body: "Tap the three dots in the top-right." },
          { icon: Plus, title: "Install app", body: "Tap “Install app” or “Add to Home screen”." },
          { icon: Check, title: "Confirm", body: "Tap “Install” / “Add”. AltShift opens like an app." },
        ];

  return (
    <Layout>
      <div className="relative min-h-[70vh] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: isIos
              ? "radial-gradient(120% 80% at 10% 0%, hsl(203 40% 92%) 0%, transparent 55%), linear-gradient(180deg, hsl(36 22% 97%) 0%, hsl(36 18% 94%) 100%)"
              : "radial-gradient(120% 80% at 90% 0%, hsl(162 35% 90%) 0%, transparent 55%), linear-gradient(180deg, hsl(36 22% 97%) 0%, hsl(36 18% 94%) 100%)",
          }}
          aria-hidden
        />
        <div className="dark:hidden pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(100% 70% at 50% -10%, hsl(203 40% 18% / 0.45) 0%, transparent 50%), linear-gradient(180deg, hsl(0 0% 4%) 0%, hsl(0 0% 7%) 100%)",
          }}
          aria-hidden
        />

        <div className="relative container mx-auto max-w-lg px-4 py-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {fr ? "Application AltShift" : "AltShift app"}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            {isIos
              ? fr
                ? "iPhone · écran d’accueil"
                : "iPhone · Home Screen"
              : fr
                ? "Android · écran d’accueil"
                : "Android · Home screen"}
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {fr
              ? "Pas d’App Store ni Play Store — ajoutez AltShift depuis le navigateur. Ça s’ouvre en plein écran comme une app."
              : "No App Store or Play Store listing — add AltShift from your browser. It opens full-screen like an app."}
          </p>

          <div className="mt-6 flex gap-2">
            <Link
              to="/get-app/android"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                !isIos
                  ? "bg-foreground text-background"
                  : "border border-border bg-background/60 text-foreground hover:bg-foreground/5",
              )}
            >
              Android
            </Link>
            <Link
              to="/get-app/ios"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                isIos
                  ? "bg-foreground text-background"
                  : "border border-border bg-background/60 text-foreground hover:bg-foreground/5",
              )}
            >
              {fr ? "iPhone" : "iPhone"}
            </Link>
          </div>

          <ol className="mt-10 space-y-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {fr ? `Étape ${i + 1}` : `Step ${i + 1}`}
                    </p>
                    <h2 className="font-heading text-lg font-bold text-foreground">{step.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-10 text-sm text-muted-foreground leading-relaxed">
            {fr
              ? "Sur ordinateur (Chrome ou Edge) : icône d’installation dans la barre d’adresse, ou menu → Installer AltShift."
              : "On desktop (Chrome or Edge): use the install icon in the address bar, or menu → Install AltShift."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              {fr ? "Ouvrir AltShift" : "Open AltShift"}
            </Link>
            <Link
              to="/support"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background/70 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
            >
              {fr ? "Aide" : "Support"}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useEffect, useState } from "react";
import { CalendarCheck, Play, UserRoundSearch, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "altshift-mini-guides-enabled";

/** Small motion-led product explainers; the stored switch restores the original homepage when hidden. */
export default function HomeMiniGuides() {
  const { locale } = useLanguage();
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    try { setEnabled(localStorage.getItem(STORAGE_KEY) !== "false"); } catch { /* keep the default */ }
  }, []);
  const toggle = () => setEnabled((current) => {
    const next = !current;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* the control still works in memory */ }
    return next;
  });
  const french = locale === "fr";
  const guides = [
    { title: french ? "Décrivez votre besoin" : "Describe what you need", icon: Wrench, label: french ? "Service" : "Service", sub: french ? "Plomberie, nettoyage, bien plus" : "Plumbing, cleaning, and more" },
    { title: french ? "Comparez les pros" : "Compare professionals", icon: UserRoundSearch, label: french ? "Pros près de vous" : "Pros near you", sub: french ? "Profils, prix et avis" : "Profiles, prices, and reviews" },
    { title: french ? "Réservez en toute confiance" : "Book with confidence", icon: CalendarCheck, label: french ? "Réservation confirmée" : "Booking confirmed", sub: french ? "Votre rendez-vous est prêt" : "Your appointment is set" },
  ];
  return (
    <section className="bg-muted/45 py-12 sm:py-16" aria-label={french ? "Guides vidéo AltShift" : "AltShift video guides"}>
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{french ? "AltShift en bref" : "AltShift in a minute"}</p>
            <h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">{french ? "Voyez comment ça marche" : "See how it works"}</h2>
          </div>
          <button type="button" onClick={toggle} className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
            {enabled ? (french ? "Masquer les guides" : "Hide guides") : (french ? "Afficher les guides" : "Show guides")}
          </button>
        </div>
        {enabled ? (
          <div className="grid gap-4 md:grid-cols-3">
            {guides.map(({ title, icon: Icon, label, sub }, index) => (
              <article key={title} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/15 via-background to-secondary/20 p-4 sm:p-6">
                  <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
                  <div className={`relative mx-auto flex h-full max-w-xs items-center justify-center rounded-xl border border-border/70 bg-background/90 p-4 shadow-lg ${index === 0 ? "animate-pulse" : ""}`}>
                    <div className="w-full">
                      <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></span><span className="text-xs font-bold">{label}</span></div>
                      {index === 0 ? <div className="grid grid-cols-3 gap-2"><i className="h-10 rounded-md bg-primary/15"/><i className="h-10 rounded-md bg-secondary/20"/><i className="h-10 rounded-md bg-primary/10"/></div> : null}
                      {index === 1 ? <div className="space-y-2"><div className="h-5 rounded bg-muted"/><div className="h-5 w-4/5 rounded bg-muted"/><div className="h-5 w-3/5 rounded bg-muted"/></div> : null}
                      {index === 2 ? <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">✓</span><span className="text-xs text-muted-foreground">{sub}</span></div> : null}
                    </div>
                  </div>
                  <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"><Play size={13} fill="currentColor"/></span>
                </div>
                <p className="p-4 font-semibold">{title}</p>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">{french ? "Les guides sont masqués sur cet appareil." : "The guides are hidden on this device."}</p>}
      </div>
    </section>
  );
}

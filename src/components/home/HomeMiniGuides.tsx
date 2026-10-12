import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  CreditCard,
  Home,
  MapPin,
  Play,
  Search,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

const STORAGE_KEY = "altshift-mini-guides-enabled";
const SCENE_DURATION_MS = 6800;

/** Three synchronized, looping product walkthroughs. Only the selected scene animates. */
export default function HomeMiniGuides() {
  const { locale } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [enabled, setEnabled] = useState(true);
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) !== "false");
    } catch {
      /* Keep the default if storage is unavailable. */
    }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!enabled || reduced || !section) return;

    let timer: number | null = null;
    const start = () => {
      if (timer !== null || document.hidden) return;
      timer = window.setInterval(() => setActiveScene((current) => (current + 1) % 3), SCENE_DURATION_MS);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) start();
      else stop();
    }, { threshold: 0.25 });
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    observer.observe(section);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, reduced]);

  const french = locale === "fr";
  const guides = [
    {
      title: french ? "Décrivez votre besoin" : "Describe what you need",
      eyebrow: french ? "Service" : "Service",
      summary: french ? "Pros près de vous" : "Pros near you",
      icon: Wrench,
    },
    {
      title: french ? "Comparez les professionnels" : "Compare professionals",
      eyebrow: french ? "Comparez les pros" : "Compare pros",
      summary: french ? "Choisissez ce qui compte" : "Choose what matters",
      icon: Search,
    },
    {
      title: french ? "Réservez en toute confiance" : "Book with confidence",
      eyebrow: french ? "Réservation confirmée" : "Booking confirmed",
      summary: french ? "Votre rendez-vous est fixé" : "Your appointment is set",
      icon: CalendarCheck,
    },
  ];

  const toggle = () => setEnabled((current) => {
    const next = !current;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* The control still works in memory. */
    }
    return next;
  });

  return (
    <section ref={sectionRef} className="bg-muted/45 py-12 sm:py-16" aria-label={french ? "Guides vidéo AltShift" : "AltShift video guides"}>
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{french ? "AltShift en bref" : "AltShift in a minute"}</p>
            <h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">{french ? "Voyez comment ça marche" : "See how it works"}</h2>
          </div>
          <button type="button" onClick={toggle} className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted" aria-pressed={!enabled}>
            {enabled ? (french ? "Masquer les guides" : "Hide guides") : (french ? "Afficher les guides" : "Show guides")}
          </button>
        </div>

        {enabled ? (
          <div className="grid gap-4 md:grid-cols-3" role="list" aria-label={french ? "Étapes du service" : "Service steps"}>
            {guides.map(({ title, eyebrow, summary, icon: Icon }, index) => {
              const isActive = activeScene === index;
              return (
                <article
                  key={title}
                  role="listitem"
                  aria-current={isActive ? "step" : undefined}
                  className={`mini-guide-card overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] ${isActive ? "mini-guide-card-active border-primary/60 shadow-md" : "border-border/70"}`}
                >
                  <div className={`mini-guide-scene mini-guide-scene--${index} relative aspect-video overflow-hidden bg-gradient-to-br from-primary/15 via-background to-secondary/20 p-3 sm:p-4`}>
                    <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
                    {index === 0 ? (
                      <div className="mini-guide-search-screen relative mx-auto flex h-full max-w-md flex-col justify-center rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg sm:p-4">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold sm:text-xs"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={15} /></span><span>{eyebrow}</span></div>
                        <div className="mini-guide-searchbar flex h-9 items-center gap-2 rounded-lg border border-primary/35 bg-background px-2.5 text-[10px] text-muted-foreground shadow-sm sm:text-xs">
                          <Search size={13} className="shrink-0 text-primary" />
                          <span className="mini-guide-typed-query truncate text-foreground">{french ? "Réparation plomberie" : "Plumbing repair"}</span>
                          <span className="ml-auto shrink-0 rounded-md bg-primary px-2 py-1 text-[9px] font-bold text-primary-foreground sm:text-[10px]">{french ? "Rechercher" : "Search"}</span>
                        </div>
                        <div className="mini-guide-search-results mt-2 grid grid-cols-2 gap-2">
                          <div className="mini-guide-search-result mini-guide-search-result--one rounded-lg border bg-card p-2">
                            <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">JP</span><span className="truncate text-[9px] font-bold sm:text-[10px]">Jordan P.</span></div>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><Star size={9} className="fill-amber-400 text-amber-400" />4.9 <span>·</span> CA$95</div>
                          </div>
                          <div className="mini-guide-search-result mini-guide-search-result--two rounded-lg border bg-card p-2">
                            <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/60 text-[9px] font-bold">AM</span><span className="truncate text-[9px] font-bold sm:text-[10px]">Alex M.</span></div>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><Star size={9} className="fill-amber-400 text-amber-400" />4.8 <span>·</span> CA$110</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400"><MapPin size={11} />{summary}</div>
                      </div>
                    ) : null}

                    {index === 1 ? (
                      <div className="mini-guide-compare-screen relative mx-auto flex h-full max-w-md flex-col justify-center rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg sm:p-4">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold sm:text-xs"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={15} /></span><span>{eyebrow}</span></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="mini-guide-pro-card mini-guide-pro-card--left rounded-lg border border-emerald-500/45 bg-card p-2">
                            <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">JM</span><span className="truncate text-[9px] font-bold sm:text-[10px]">Jamie M.</span></div>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><Star size={9} className="fill-amber-400 text-amber-400" />4.9 <span>·</span> CA$95</div>
                            <div className="mt-1 flex items-center justify-between gap-1"><span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 dark:text-emerald-400">{french ? "Aujourd’hui" : "Today"}</span><Check size={12} className="text-emerald-600" /></div>
                          </div>
                          <div className="mini-guide-pro-card mini-guide-pro-card--right rounded-lg border border-border bg-card p-2">
                            <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/60 text-[9px] font-bold">TR</span><span className="truncate text-[9px] font-bold sm:text-[10px]">Taylor R.</span></div>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><Star size={9} className="fill-amber-400 text-amber-400" />4.6 <span>·</span> CA$130</div>
                            <div className="mt-1 flex items-center justify-between gap-1"><span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-bold text-rose-700 dark:text-rose-400">{french ? "Demain" : "Tomorrow"}</span><span className="text-[8px] text-muted-foreground">{french ? "Plus cher" : "Higher price"}</span></div>
                          </div>
                        </div>
                        <div className="mini-guide-priority mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-[9px] font-semibold text-emerald-800 dark:text-emerald-300">
                          <span>{summary}: {french ? "prix · avis · disponibilité" : "price · reviews · availability"}</span><span className="shrink-0">{french ? "Meilleur choix" : "Best match"}</span>
                        </div>
                        <button type="button" tabIndex={-1} aria-hidden="true" className="mini-guide-select mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[9px] font-bold text-primary-foreground"><span>{french ? "Choisir Jamie" : "Choose Jamie"}</span><ArrowRight size={11} /></button>
                      </div>
                    ) : null}

                    {index === 2 ? (
                      <div className="mini-guide-booking-scene relative flex h-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-border/70 bg-background/90 p-3 shadow-lg sm:gap-4 sm:p-4">
                        <div className="mini-guide-phone relative z-10 w-[54%] max-w-[13rem] rounded-[1rem] border-[3px] border-slate-800 bg-card p-2 shadow-xl sm:p-2.5">
                          <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted-foreground/40" />
                          <div className="rounded-lg border bg-background p-2">
                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 sm:text-[10px]"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15"><Check size={11} /></span>{eyebrow}</div>
                            <p className="mt-1 text-[9px] font-semibold sm:text-[10px]">✓ {summary}</p>
                            <div className="mt-2 flex items-center gap-1 text-[8px] text-muted-foreground"><Clock3 size={10} />{french ? "Mercredi · 12 h 30" : "Wednesday · 12:30 PM"}</div>
                            <div className="mt-2 flex items-center justify-between rounded bg-muted/60 px-1.5 py-1 text-[8px]"><span className="flex items-center gap-1"><CreditCard size={10} />{french ? "Paiement" : "Payment"}</span><span className="font-bold">CA$95.00</span></div>
                            <div className="mini-guide-payment mt-1 flex items-center justify-center gap-1 rounded bg-emerald-600 px-1.5 py-1 text-[8px] font-bold text-white"><ShieldCheck size={10} />{french ? "Paiement confirmé" : "Payment confirmed"}</div>
                          </div>
                        </div>
                        <div className="mini-guide-home relative z-0 flex h-[72%] min-w-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg bg-sky-100/80 px-2 pb-1 dark:bg-sky-950/40">
                          <div className="absolute left-0 right-0 top-[15%] h-px bg-sky-300/50 dark:bg-sky-500/20" />
                          <div className="mini-guide-house relative z-10 flex h-[52%] w-[82%] flex-col items-center justify-end rounded-t-sm border border-amber-900/20 bg-amber-100 dark:bg-amber-900/45">
                            <div className="absolute -top-[32%] left-[3%] right-[3%] h-[58%] bg-rose-400 dark:bg-rose-950" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
                            <div className="relative z-10 flex h-[64%] w-[23%] items-center justify-center rounded-t-md bg-amber-700/75 text-white"><Home size={12} /></div>
                          </div>
                          <div className="mini-guide-meet-pro absolute bottom-[4%] left-[36%] z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-[8px] font-bold text-primary-foreground shadow-md">JM</div>
                          <span className="relative z-10 mt-1 max-w-full truncate text-[8px] font-semibold text-slate-700 dark:text-slate-200">{french ? "Chez vous" : "At your home"}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white" aria-hidden="true"><Play size={11} fill="currentColor" /></div>
                  </div>
                  <button type="button" onClick={() => setActiveScene(index)} className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-pressed={isActive}>
                    <span className="min-w-0">
                      <span className="block font-semibold">{title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{summary}</span>
                    </span>
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground/25"}`} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : <p className="text-sm text-muted-foreground">{french ? "Les guides sont masqués sur cet appareil." : "The guides are hidden on this device."}</p>}
      </div>
    </section>
  );
}

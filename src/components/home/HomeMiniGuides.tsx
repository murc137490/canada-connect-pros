import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, MapPin, MessageCircle, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import RiveGuideScene from "@/components/home/RiveGuideScene";

const STORAGE_KEY = "altshift-mini-guides-enabled";
const LOOP_MS = 15_200;
const SCENES = [
  { at: 0, title: { en: "Describe what you need", fr: "Décrivez votre besoin" }, summary: { en: "Pros near you", fr: "Pros près de vous" } },
  { at: 3_700, title: { en: "Compare professionals", fr: "Comparez les professionnels" }, summary: { en: "Choose what matters to you", fr: "Choisissez ce qui compte" } },
  { at: 7_400, title: { en: "Booking confirmed", fr: "Réservation confirmée" }, summary: { en: "Your appointment is set", fr: "Votre rendez-vous est fixé" } },
  { at: 11_300, title: { en: "Stay in touch", fr: "Restez en contact" }, summary: { en: "Message your professional", fr: "Écrivez à votre professionnel" } },
] as const;

function SceneContent({ scene, french, active }: { scene: number; french: boolean; active: boolean }) {
  return (
    <div className={`story-scene story-scene-${scene} ${active ? "story-scene-active" : ""} relative flex h-[390px] items-center justify-center overflow-hidden rounded-[1.5rem] border bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-3 transition-[transform,box-shadow,opacity] duration-300 will-change-transform sm:h-[410px] sm:p-4 xl:h-[430px] ${active ? "z-20 scale-[1.08] border-border/70 opacity-100 shadow-xl sm:scale-[1.16] xl:scale-[1.25]" : "border-border/70 opacity-80"}`}>
      <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
      {scene === 0 ? (
        <div className="story-search-panel relative w-full max-w-xl rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wrench size={16} /></span>{french ? "Service" : "Service"}</div>
          <div className="story-searchbar flex items-center gap-2 rounded-xl border border-primary/35 bg-card px-3 py-2.5 text-sm shadow-sm"><Search size={16} className="shrink-0 text-primary" /><span className="story-query truncate">{french ? "Réparation plomberie" : "Plumbing repair"}</span><span className="ml-auto rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground">{french ? "Rechercher" : "Search"}</span></div>
          <div className="story-results mt-3 grid grid-cols-3 gap-1.5">
            {[ ["Émilie B.", "4.9", "CA$95", french ? "Aujourd’hui" : "Today"], ["Félix T.", "4.9", "CA$105", french ? "Aujourd’hui" : "Today"], ["Jean G.", "4.6", "CA$130", french ? "Demain" : "Tomorrow"] ].map(([name, rating, price, day], i) => (
              <article key={name} className="story-pro-card min-w-0 rounded-xl border bg-card p-2 shadow-sm" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="flex min-w-0 items-center gap-1"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{name.split(" ").map((x) => x[0]).join("")}</span><span className="truncate text-[10px] font-semibold sm:text-xs">{name}</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]"><span className="inline-flex items-center gap-0.5"><Star size={10} className="fill-amber-400 text-amber-400" />{rating}</span><span className="text-muted-foreground">·</span><span className="font-bold">{price}</span></div>
                <p className="mt-1 text-[10px] text-muted-foreground">{day}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><MapPin size={13} />{french ? "Professionnels fictifs près de Montréal, Québec" : "Fictional professionals near Montréal, Québec"}</p>
        </div>
      ) : null}
      {scene === 1 ? (
        <div className="story-compare-panel relative w-full max-w-2xl rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-heading text-lg font-bold sm:text-xl">{french ? "Plomberie · Réparation" : "Plumbing · Repair"}</h3><span className="text-xs text-muted-foreground">{french ? "Choisissez selon vos priorités" : "Choose what matters to you"}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Émilie B.", "4.9", "CA$95", french ? "Aujourd’hui" : "Today", "ÉB"], ["Jean G.", "4.6", "CA$130", french ? "Demain" : "Tomorrow", "JG"]].map(([name, rating, price, day, initials], index) => (
              <article key={name} className={`story-compare-card min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-sm ${index === 0 ? "border-emerald-500/50" : ""}`} style={{ animationDelay: `${index * 150}ms` }}>
                {index === 0 ? <div className="mb-2"><span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">{french ? "Meilleure correspondance" : "Best match"}</span></div> : null}
                <div className="flex items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{initials}</span>{name}</div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                  <div className="story-compare-value flex items-center justify-center rounded-lg bg-muted/40 p-1.5"><p className="text-xs font-bold">{price.replace("CA$", "")}$</p></div>
                  <div className="story-compare-value flex items-center justify-center rounded-lg bg-muted/40 p-1.5"><p className="inline-flex items-center gap-1 text-xs font-bold"><Star size={11} className="fill-amber-400 text-amber-400" />{rating}</p></div>
                  <div className="story-compare-value min-w-0 rounded-lg bg-muted/40 p-1.5"><p className="whitespace-nowrap text-[8px] uppercase leading-tight text-muted-foreground">{french ? "Dispo" : "Available"}</p><p className="mt-1 whitespace-nowrap text-[10px] font-bold">{day}</p></div>
                </div>
                {index === 0 ? <button type="button" tabIndex={-1} aria-hidden="true" className="mt-2 flex min-h-10 w-full min-w-0 items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground whitespace-nowrap">{french ? "Voir le profil" : "View profile"}</button> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {scene === 2 ? (
        <div className="story-booking-panel relative w-full max-w-md rounded-2xl border border-border/70 bg-background/95 p-5 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Check size={23} /></div><div><h3 className="font-heading text-xl font-bold">{french ? "Réservation confirmée" : "Booking confirmed"}</h3><p className="text-sm text-muted-foreground">{french ? "Votre rendez-vous est fixé" : "Your appointment is set"}</p></div></div>
          <div className="space-y-3 rounded-xl border bg-card p-4 text-sm"><div className="flex justify-between gap-4"><span>{french ? "Service" : "Service"}</span><b>{french ? "Réparation plomberie" : "Plumbing repair"}</b></div><div className="flex justify-between gap-4"><span>{french ? "Professionnel" : "Professional"}</span><b>Émilie B. · 4.9</b></div><div className="flex justify-between gap-4"><span>{french ? "Date" : "Date"}</span><b>{french ? "Mercredi · 12 h 30" : "Wednesday · 12:30 PM"}</b></div><div className="flex justify-between gap-4"><span>{french ? "Prix" : "Price"}</span><b>CA$95.00</b></div><div className="flex justify-between gap-4 text-muted-foreground"><span className="inline-flex items-center gap-2"><CreditCard size={15} />{french ? "Paiement" : "Payment"}</span><b>•••• 4242</b></div></div>
          <div className="story-confirm mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white"><ShieldCheck size={18} />{french ? "Paiement confirmé" : "Payment confirmed"}</div>
        </div>
      ) : null}
      {scene === 3 ? (
        <div className="w-full space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400"><Check size={16} />{french ? "Réservation confirmée" : "Booking confirmed"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Émilie B. · 12:30 · {french ? "Réparation plomberie" : "Plumbing repair"}</p>
          </div>
          <div className="space-y-2 rounded-xl border bg-background/90 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><MessageCircle size={12} />{french ? "Messages" : "Messages"}</div>
            <p className="story-chat-message max-w-[92%] rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-xs leading-relaxed">{french ? "Je serai là dans 20 minutes." : "I’ll be there in 20 minutes."}</p>
            <p className="story-chat-message ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground" style={{ animationDelay: "1s" }}>{french ? "Parfait ! À tout à l’heure." : "Perfect! See you then."}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function HomeMiniGuides() {
  const { locale } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const timelineStartRef = useRef(0);
  const [enabled, setEnabled] = useState(true);
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    try { setEnabled(localStorage.getItem(STORAGE_KEY) !== "false"); } catch { /* Keep default. */ }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!enabled || reduced || !section) return;
    let timer: number | null = null;
    const start = () => {
      if (timer !== null || document.hidden) return;
      timelineStartRef.current = performance.now();
      timer = window.setInterval(() => {
        const elapsed = (performance.now() - timelineStartRef.current) % LOOP_MS;
        let next = 0;
        for (let i = SCENES.length - 1; i >= 0; i--) if (elapsed >= SCENES[i].at) { next = i; break; }
        setActiveScene((current) => current === next ? current : next);
      }, 250);
    };
    const stop = () => { if (timer !== null) window.clearInterval(timer); timer = null; };
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting ? start() : stop(), { threshold: 0.25 });
    const onVisibilityChange = () => document.hidden ? stop() : start();
    observer.observe(section);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stop(); observer.disconnect(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [enabled, reduced]);

  const french = locale === "fr";
  const toggle = () => setEnabled((current) => {
    const next = !current;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Keep in memory. */ }
    return next;
  });
  return (
    <section ref={sectionRef} className="bg-muted/45 py-12 sm:py-16" aria-label={french ? "Guide AltShift" : "AltShift walkthrough"}>
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{french ? "AltShift en bref" : "AltShift in a minute"}</p><h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">{french ? "Voyez comment ça marche" : "See how it works"}</h2></div><button type="button" onClick={toggle} className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted" aria-pressed={!enabled}>{enabled ? (french ? "Masquer le guide" : "Hide guide") : (french ? "Afficher le guide" : "Show guide")}</button></div>
        {enabled ? <div className="mx-auto max-w-[100rem]"><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{SCENES.map((scene, i) => <article key={scene.at} role="button" tabIndex={0} aria-pressed={activeScene === i} onClick={() => { timelineStartRef.current = performance.now() - scene.at; setActiveScene(i); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); timelineStartRef.current = performance.now() - scene.at; setActiveScene(i); } }} className={`min-w-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-500 ${activeScene === i ? "z-10" : ""}`}><div className="mb-2 flex min-h-[4rem] items-center justify-between gap-2"><div><h3 className="font-heading text-base font-bold">{scene.title[french ? "fr" : "en"]}</h3><p className="text-sm text-muted-foreground">{scene.summary[french ? "fr" : "en"]}</p></div><RiveGuideScene scene={i} active={enabled && !reduced && activeScene === i} /></div><SceneContent scene={i} french={french} active={activeScene === i} /></article>)}</div></div> : <p className="text-sm text-muted-foreground">{french ? "Le guide est masqué sur cet appareil." : "The guide is hidden on this device."}</p>}
      </div>
    </section>
  );
}

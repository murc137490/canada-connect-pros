import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Check, Clock3, CreditCard, Home, MapPin, Play, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

const STORAGE_KEY = "altshift-mini-guides-enabled";
const LOOP_MS = 43_000;
const SCENES = [
  { at: 0, title: { en: "Describe what you need", fr: "Décrivez votre besoin" }, summary: { en: "Pros near you", fr: "Pros près de vous" } },
  { at: 10_000, title: { en: "Compare professionals", fr: "Comparez les professionnels" }, summary: { en: "Choose what matters to you", fr: "Choisissez ce qui compte" } },
  { at: 21_000, title: { en: "Booking confirmed", fr: "Réservation confirmée" }, summary: { en: "Your appointment is set", fr: "Votre rendez-vous est fixé" } },
  { at: 34_000, title: { en: "Service at your home", fr: "Le service chez vous" }, summary: { en: "Meet your professional", fr: "Rencontrez votre professionnel" } },
] as const;

function SceneContent({ scene, french }: { scene: number; french: boolean }) {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (scene !== 3 || !videoReady || !videoRef.current) return;
    void videoRef.current.play().catch(() => setVideoFailed(true));
    return () => videoRef.current?.pause();
  }, [scene, videoReady]);

  return (
    <div key={scene} className={`story-scene story-scene-${scene} relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-4 sm:min-h-[360px] sm:p-8 lg:min-h-[410px]`}>
      <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
      {scene === 0 ? (
        <div className="story-search-panel relative w-full max-w-xl rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wrench size={18} /></span>{french ? "Service" : "Service"}</div>
          <div className="story-searchbar flex items-center gap-2 rounded-xl border border-primary/35 bg-card px-3 py-3 text-sm shadow-sm"><Search size={17} className="text-primary" /><span className="story-query">{french ? "Réparation plomberie" : "Plumbing repair"}</span><span className="ml-auto rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">{french ? "Rechercher" : "Search"}</span></div>
          <div className="story-results mt-4 grid gap-3 sm:grid-cols-3">
            {[ ["Jamie M.", "4.9", "CA$95", french ? "Aujourd’hui" : "Today"], ["Jordan P.", "4.9", "CA$105", french ? "Aujourd’hui" : "Today"], ["Taylor R.", "4.6", "CA$130", french ? "Demain" : "Tomorrow"] ].map(([name, rating, price, day], i) => (
              <article key={name} className="story-pro-card rounded-xl border bg-card p-3 shadow-sm" style={{ animationDelay: `${i * 350}ms` }}>
                <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{name.split(" ").map((x) => x[0]).join("")}</span><span className="font-semibold">{name}</span></div>
                <div className="mt-3 flex items-center gap-2 text-sm"><span className="inline-flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" />{rating}</span><span className="text-muted-foreground">·</span><span className="font-bold">{price}</span></div>
                <p className="mt-2 text-xs text-muted-foreground">{day}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><MapPin size={14} />{french ? "Professionnels fictifs à proximité" : "Fictional professionals near you"}</p>
        </div>
      ) : null}
      {scene === 1 ? (
        <div className="story-compare-panel relative w-full max-w-2xl rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-heading text-lg font-bold sm:text-xl">{french ? "Plomberie · Réparation" : "Plumbing · Repair"}</h3><span className="text-xs text-muted-foreground">{french ? "Choisissez selon vos priorités" : "Choose what matters to you"}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Jamie M.", "4.9", "CA$95", french ? "Aujourd’hui" : "Today", "JM"], ["Taylor R.", "4.6", "CA$130", french ? "Demain" : "Tomorrow", "TR"]].map(([name, rating, price, day, initials], index) => (
              <article key={name} className={`story-compare-card rounded-xl border bg-card p-4 shadow-sm ${index === 0 ? "border-emerald-500/50" : ""}`} style={{ animationDelay: `${index * 450}ms` }}>
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{initials}</span>{name}</span>{index === 0 ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{french ? "Meilleure correspondance" : "Best match"}</span> : null}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="story-compare-value rounded-lg bg-muted/40 p-2"><p className="text-[10px] uppercase text-muted-foreground">{french ? "Prix" : "Price"}</p><p className="mt-1 font-bold">{price}</p></div><div className="story-compare-value rounded-lg bg-muted/40 p-2"><p className="text-[10px] uppercase text-muted-foreground">{french ? "Avis" : "Reviews"}</p><p className="mt-1 inline-flex items-center gap-1 font-bold"><Star size={12} className="fill-amber-400 text-amber-400" />{rating}</p></div><div className="story-compare-value rounded-lg bg-muted/40 p-2"><p className="text-[10px] uppercase text-muted-foreground">{french ? "Dispo" : "Available"}</p><p className="mt-1 text-xs font-bold">{day}</p></div></div>
                {index === 0 ? <button type="button" tabIndex={-1} aria-hidden="true" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground">{french ? "Voir le profil · Réserver Jamie" : "View profile · Book Jamie"}<ArrowRight size={15} /></button> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {scene === 2 ? (
        <div className="story-booking-panel relative w-full max-w-md rounded-2xl border border-border/70 bg-background/95 p-5 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Check size={23} /></div><div><h3 className="font-heading text-xl font-bold">{french ? "Réservation confirmée" : "Booking confirmed"}</h3><p className="text-sm text-muted-foreground">{french ? "Votre rendez-vous est fixé" : "Your appointment is set"}</p></div></div>
          <div className="space-y-3 rounded-xl border bg-card p-4 text-sm"><div className="flex justify-between gap-4"><span>{french ? "Service" : "Service"}</span><b>{french ? "Réparation plomberie" : "Plumbing repair"}</b></div><div className="flex justify-between gap-4"><span>{french ? "Professionnel" : "Professional"}</span><b>Jamie M. · 4.9</b></div><div className="flex justify-between gap-4"><span>{french ? "Date" : "Date"}</span><b>{french ? "Mercredi · 12 h 30" : "Wednesday · 12:30 PM"}</b></div><div className="flex justify-between gap-4"><span>{french ? "Prix" : "Price"}</span><b>CA$95.00</b></div><div className="flex justify-between gap-4 text-muted-foreground"><span className="inline-flex items-center gap-2"><CreditCard size={15} />{french ? "Paiement" : "Payment"}</span><b>•••• 4242</b></div></div>
          <div className="story-confirm mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white"><ShieldCheck size={18} />{french ? "Paiement confirmé" : "Payment confirmed"}</div>
        </div>
      ) : null}
      {scene === 3 ? (
        <div className="relative flex h-full min-h-[250px] w-full items-center justify-center sm:min-h-[330px]">
          {!videoFailed ? <video ref={videoRef} src="/videos/altshift-service-arrival.mp4" muted playsInline preload="metadata" onCanPlay={() => setVideoReady(true)} onError={() => setVideoFailed(true)} className={`absolute inset-0 h-full w-full rounded-2xl object-cover transition-opacity ${videoReady ? "opacity-100" : "opacity-0"}`} aria-label={french ? "Un professionnel arrive chez un client" : "A professional arrives at a client's home"} /> : null}
          {!videoReady || videoFailed ? <div className="story-arrival-fallback absolute inset-0 flex items-center justify-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-100/80 via-background to-primary/10 p-5 dark:from-sky-950/40 sm:gap-8">
            <div className="story-arrival-phone z-10 w-36 rounded-[1.3rem] border-[4px] border-slate-800 bg-card p-2 shadow-xl sm:w-44"><div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted-foreground/40" /><div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"><Check size={13} />{french ? "Confirmé" : "Confirmed"}</div><p className="mt-2 text-xs font-semibold">Jamie M. · 12:30</p><p className="mt-2 text-[10px] text-muted-foreground">{french ? "Réparation plomberie" : "Plumbing repair"}</p></div></div>
            <div className="story-arrival-home relative flex h-40 w-48 flex-col items-center justify-end rounded-t-lg border border-amber-900/20 bg-amber-100 pb-3 dark:bg-amber-900/45 sm:h-52 sm:w-64"><div className="absolute -top-[28%] left-0 right-0 h-[48%] bg-rose-400 dark:bg-rose-950" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} /><div className="relative z-10 flex h-24 w-14 items-end justify-center rounded-t-md bg-amber-700/75 pb-2 text-white"><Home size={17} /></div><div className="story-arrival-pro absolute bottom-4 left-2 z-20 flex size-10 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground shadow-lg">JM</div><p className="relative z-10 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{french ? "À votre domicile" : "At your home"}</p></div>
          </div> : null}
          <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"><Play size={12} fill="currentColor" />{french ? "Scène illustrée" : "Illustrative scene"}</div>
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
  const current = SCENES[activeScene];

  return (
    <section ref={sectionRef} className="bg-muted/45 py-12 sm:py-16" aria-label={french ? "Guide AltShift" : "AltShift walkthrough"}>
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{french ? "AltShift en bref" : "AltShift in a minute"}</p><h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">{french ? "Voyez comment ça marche" : "See how it works"}</h2></div><button type="button" onClick={toggle} className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted" aria-pressed={!enabled}>{enabled ? (french ? "Masquer le guide" : "Hide guide") : (french ? "Afficher le guide" : "Show guide")}</button></div>
        {enabled ? <div className="mx-auto max-w-5xl"><SceneContent scene={activeScene} french={french} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-heading text-lg font-bold">{current.title[french ? "fr" : "en"]}</h3><p className="text-sm text-muted-foreground">{current.summary[french ? "fr" : "en"]}</p></div><div className="flex gap-2" role="tablist" aria-label={french ? "Étapes" : "Steps"}>{SCENES.map((scene, i) => <button key={scene.at} type="button" role="tab" aria-selected={activeScene === i} aria-label={`${i + 1}. ${scene.title[french ? "fr" : "en"]}`} onClick={() => { timelineStartRef.current = performance.now() - scene.at; setActiveScene(i); }} className={`size-2.5 rounded-full transition-all ${activeScene === i ? "scale-125 bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"}`} />)}</div></div></div> : <p className="text-sm text-muted-foreground">{french ? "Le guide est masqué sur cet appareil." : "The guide is hidden on this device."}</p>}
      </div>
    </section>
  );
}

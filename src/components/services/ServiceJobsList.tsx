import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyProProfile } from "@/lib/proProfileAccess";

type ServiceJob = {
  id: string;
  description: string;
  category: string;
  city: string | null;
  province: string | null;
  photo_urls: string[] | null;
  budget_range: string | null;
  timing: string | null;
  created_at: string;
  service_slug: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Props = { categorySlug: string; serviceSlug: string };

const LEGACY_CATEGORIES_BY_SERVICE: Record<string, string[]> = {
  "plumbing-services": ["plumbing"],
  "drain-cleaning": ["plumbing"],
  "water-heater-services": ["plumbing"],
  "hvac-services": ["hvac"],
  "furnace-repair": ["hvac"],
  "ac-repair": ["hvac"],
  "house-cleaning": ["cleaning"],
  "deep-cleaning": ["cleaning"],
  "move-in-out-cleaning": ["cleaning"],
  "carpet-cleaning": ["cleaning"],
  "window-cleaning": ["cleaning"],
  "commercial-cleaning": ["cleaning"],
  "pressure-washing": ["cleaning"],
  "furniture-assembly": ["furniture assembly", "handyman"],
  "local-moving": ["moving"],
  "long-distance-moving": ["moving"],
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatBudget(value: string | null, locale: string) {
  if (!value?.trim()) return null;
  const parts = value.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return `${parts.map((part) => `$${part}`).join(locale === "fr" ? " à " : " – ")}`;
  return `$${parts[0]}`;
}

export default function ServiceJobsList({ categorySlug, serviceSlug }: Props) {
  const { locale, t } = useLanguage();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [proId, setProId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        if (!cancelled) { setJobs([]); setProId(null); setLoading(false); }
        return;
      }
      setLoading(true);
      const { data: pro } = await fetchMyProProfile<{ id: string; is_verified: boolean | null; latitude: number | null; longitude: number | null; service_radius_km: number | null }>("id, is_verified, latitude, longitude, service_radius_km");
      if (cancelled) return;
      if (!pro?.is_verified) {
        setJobs([]); setProId(null); setLoading(false);
        return;
      }
      setProId(pro.id);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let res = await supabase.from("job_requests")
        .select("id, description, category, city, province, photo_urls, budget_range, timing, created_at, service_slug, category_slug, latitude, longitude")
        .eq("status", "open")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);
      // Keep serving current postings created before service tagging was added.
      if (res.error && /service_slug|category_slug|column/i.test(res.error.message)) {
        res = await supabase.from("job_requests")
          .select("id, description, category, city, province, photo_urls, budget_range, timing, created_at, latitude, longitude")
          .eq("status", "open")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(200);
      }
      if (cancelled) return;
      const aliases = LEGACY_CATEGORIES_BY_SERVICE[serviceSlug] ?? [];
      let matching = ((res.data ?? []) as ServiceJob[]).filter((job) => {
        if (job.service_slug) return job.service_slug === serviceSlug && (!job.category_slug || job.category_slug === categorySlug);
        const oldCategory = job.category.trim().toLowerCase();
        return aliases.includes(oldCategory);
      });
      const lat = typeof pro.latitude === "number" ? pro.latitude : null;
      const lng = typeof pro.longitude === "number" ? pro.longitude : null;
      if (lat != null && lng != null) {
        const radius = typeof pro.service_radius_km === "number" ? pro.service_radius_km : 50;
        matching = matching.filter((job) => {
          if (job.latitude == null || job.longitude == null) return true;
          return distanceKm(lat, lng, job.latitude, job.longitude) <= radius;
        });
      }
      setJobs(matching);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [categorySlug, serviceSlug, user]);

  if (loading) return <p className="py-6 text-sm text-muted-foreground">{t.common.loading}</p>;
  if (!jobs.length) {
    return <p className="py-6 text-sm text-muted-foreground">{t.dashboard.availableJobsEmpty}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{jobs.length} {locale === "fr" ? "demande(s) ouverte(s)" : `open ${jobs.length === 1 ? "request" : "requests"}`}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => {
          const budget = formatBudget(job.budget_range, locale);
          const ageDays = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86_400_000));
          return (
            <article key={job.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {job.photo_urls?.length ? (
                <div className="grid grid-cols-3 gap-1 bg-muted p-1">
                  {job.photo_urls.slice(0, 3).map((url, index) => (
                    <img key={`${url}-${index}`} src={url} alt="" loading="lazy" className="h-28 w-full rounded-md object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-foreground">{job.category}</h2>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13} />{locale === "fr" ? `${ageDays} j` : `Posted ${ageDays}d ago`}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.description}</p>
                {(job.city || job.province) && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={13} />{[job.city, job.province].filter(Boolean).join(", ")}</p>}
                {budget && <p className="text-sm font-semibold text-foreground">{locale === "fr" ? "Budget : " : "Budget: "}{budget}</p>}
                {job.timing && <p className="text-xs text-muted-foreground">{job.timing}</p>}
                {proId && <Button asChild className="w-full"><Link to={`/dashboard?jobs=1&quoteJob=${encodeURIComponent(job.id)}#dashboard-open-leads`}>{locale === "fr" ? "Voir et envoyer un devis" : "View job & send quote"}<ArrowRight size={16} /></Link></Button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

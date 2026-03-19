import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/geocode";
import { MapPin, Loader2 } from "lucide-react";

type Result = "idle" | "loading" | "yes" | "no" | "error";

interface ServingPro {
  pro_profile_id: string;
  business_name: string;
  location: string | null;
  service_radius_km: number | null;
  distance_km: number;
}

export default function CheckServiceArea() {
  const { t } = useLanguage();
  const [postalOrCity, setPostalOrCity] = useState("");
  const [result, setResult] = useState<Result>("idle");
  const [pros, setPros] = useState<ServingPro[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = postalOrCity.trim();
    if (!query) return;

    setResult("loading");
    setPros([]);
    setErrorMessage("");

    try {
      const coords = await geocodeAddress(query);
      if (!coords) {
        setResult("error");
        setErrorMessage(t.index.checkServiceError);
        return;
      }

      const { data, error } = await supabase.rpc("get_pros_serving_point", {
        p_lat: coords.lat,
        p_lng: coords.lng,
      });

      if (error) {
        setResult("error");
        setErrorMessage(error.message);
        return;
      }

      const list = (data ?? []) as ServingPro[];
      setPros(list);
      setResult(list.length > 0 ? "yes" : "no");
    } catch (err) {
      setResult("error");
      setErrorMessage((err as Error).message ?? t.index.checkServiceError);
    }
  };

  const hasGeocodeKey = !!import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  return (
    <section className="py-10 md:py-14 scroll-fade-in">
      <div className="container px-4 md:px-6">
        <div className="glass-card glass-hover rounded-2xl p-6 md:p-8 max-w-xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-5 text-secondary shrink-0" />
            <h2 className="font-heading text-xl font-bold">{t.index.checkServiceTitle}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.index.checkServiceDesc}
          </p>

          {!hasGeocodeKey ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">{t.index.checkServiceNoKey}</p>
          ) : (
            <form onSubmit={handleCheck} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                value={postalOrCity}
                onChange={(e) => setPostalOrCity(e.target.value)}
                placeholder={t.index.checkServicePlaceholder}
                className="flex-1"
                disabled={result === "loading"}
              />
              <Button type="submit" disabled={result === "loading"} className="gap-2 shrink-0">
                {result === "loading" && <Loader2 size={16} className="animate-spin" />}
                {result === "loading" ? t.index.checkServiceLoading : t.index.checkServiceButton}
              </Button>
            </form>
          )}

          {result === "yes" && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t.index.checkServiceYes.replace("{count}", String(pros.length))}
              </p>
              <ul className="space-y-1">
                {pros.slice(0, 5).map((p) => (
                  <li key={p.pro_profile_id}>
                    <Link
                      to={`/pros/${p.pro_profile_id}`}
                      className="text-sm text-secondary hover:underline font-medium"
                    >
                      {p.business_name}
                      {p.distance_km != null && (
                        <span className="text-muted-foreground font-normal ml-1">({Math.round(p.distance_km)} km)</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {pros.length > 5 && (
                <p className="text-xs text-muted-foreground">+ {pros.length - 5} more. Search services above to see all.</p>
              )}
            </div>
          )}

          {result === "no" && (
            <p className="pt-4 border-t border-border text-sm text-muted-foreground">
              {t.index.checkServiceNo}
            </p>
          )}

          {result === "error" && (
            <p className="pt-4 border-t border-border text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, MessageSquareText } from "lucide-react";

type Recommendation = {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  created_at: string;
};

export default function AdminSiteRecommendations() {
  const { locale } = useLanguage();
  const fr = locale === "fr";
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("front_desk_tickets")
      .select("id, subject, body, status, created_at")
      .eq("kind", "feature_request")
      .ilike("subject", "About page recommendation:%")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setItems((data as Recommendation[] | null) ?? []);
        setError(Boolean(queryError));
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="mb-6 rounded-xl border bg-card p-5 md:p-6" aria-labelledby="admin-site-recommendations-title">
      <h2 id="admin-site-recommendations-title" className="mb-4 flex items-center gap-2 font-heading text-xl font-bold">
        <MessageSquareText className="h-5 w-5" />{fr ? "Recommandations du site" : "Site recommendations"}
      </h2>
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : error ? <p role="alert" className="text-sm text-destructive">{fr ? "Impossible de charger les recommandations." : "Recommendations could not be loaded."}</p>
          : items.length === 0 ? <p className="text-sm text-muted-foreground">{fr ? "Aucune recommandation pour le moment." : "No recommendations yet."}</p>
            : <ul className="max-h-[34rem] space-y-3 overflow-auto">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{item.subject}</h3>
                    <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString(fr ? "fr-CA" : "en-CA")}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>}
    </section>
  );
}

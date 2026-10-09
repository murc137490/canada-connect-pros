import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { untypedDb } from "@/lib/untypedSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GROWTH_COPY } from "@/lib/growthTools";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /book-again/:bookingId → the pro's page with the past booking pre-filled (?rebook=). */
export default function BookAgain() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { locale } = useLanguage();
  const c = GROWTH_COPY[locale === "fr" ? "fr" : "en"].bookAgain;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!UUID_RE.test(bookingId)) {
      setFailed(true);
      return;
    }
    if (!user) {
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(`/book-again/${bookingId}`)}`, { replace: true });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await untypedDb
        .from("bookings")
        .select("id, pro_profile_id, client_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (cancelled) return;
      const row = data as { id: string; pro_profile_id: string; client_id: string } | null;
      if (error || !row || row.client_id !== user.id) {
        setFailed(true);
        return;
      }
      navigate(`/pros/${row.pro_profile_id}?rebook=${row.id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        {failed ? (
          <>
            <AlertTriangle className="mx-auto size-8 text-amber-500" aria-hidden />
            <p className="text-sm text-muted-foreground">{c.notFound}</p>
            <Button asChild variant="outline">
              <Link to="/dashboard?tab=bookings">{GROWTH_COPY[locale === "fr" ? "fr" : "en"].unsubscribe.dashboard}</Link>
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">{c.loading}</p>
          </>
        )}
      </div>
    </div>
  );
}

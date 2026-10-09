import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { untypedDb } from "@/lib/untypedSupabase";
import { GROWTH_COPY } from "@/lib/growthTools";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One-click opt-out from rebooking reminders (link in the reminder email / List-Unsubscribe). */
export default function RebookUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { locale } = useLanguage();
  const c = GROWTH_COPY[locale === "fr" ? "fr" : "en"].unsubscribe;
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!UUID_RE.test(token)) {
      setState("failed");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await untypedDb.rpc("rebook_unsubscribe", { p_token: token });
      if (cancelled) return;
      setState(!error && data === true ? "done" : "failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        <h1 className="font-heading text-xl font-bold text-foreground">{c.title}</h1>
        {state === "working" ? (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">{c.working}</p>
          </>
        ) : (
          <>
            {state === "done" ? (
              <CheckCircle2 className="mx-auto size-8 text-green-600" aria-hidden />
            ) : (
              <AlertTriangle className="mx-auto size-8 text-amber-500" aria-hidden />
            )}
            <p className="text-sm text-muted-foreground">{state === "done" ? c.done : c.failed}</p>
            <Button asChild variant="outline">
              <Link to="/dashboard?tab=bookings">{c.dashboard}</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

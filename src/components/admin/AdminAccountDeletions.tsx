import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, ShieldAlert, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DeletionRequest = {
  id: string;
  user_id: string;
  status: string;
  reason?: string | null;
  requested_at: string;
  confirmed_at?: string | null;
  scheduled_delete_at?: string | null;
  processed_at?: string | null;
  admin_notes?: string | null;
  user_email?: string;
};

export default function AdminAccountDeletions() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-deletion", {
        body: { action: "admin_list" },
      });
      if (error || !data?.ok) {
        toast({
          title: "Error loading requests",
          description: error?.message || data?.error,
          variant: "destructive",
        });
      } else {
        setRequests(data.requests || []);
      }
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleExecute = async (req: DeletionRequest) => {
    if (
      !window.confirm(
        locale === "fr"
          ? `Êtes-vous certain de vouloir purger définitivement l'utilisateur ${req.user_id} ? Cette action est irréversible.`
          : `Are you sure you want to permanently purge user ${req.user_id}? This action is irreversible.`
      )
    ) {
      return;
    }

    setActingId(req.id);
    try {
      const { data, error } = await supabase.functions.invoke("account-deletion", {
        body: { action: "execute", user_id: req.user_id },
      });
      if (error || !data?.ok) {
        toast({
          title: "Execution failed",
          description: error?.message || data?.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: locale === "fr" ? "Compte purgé" : "Account purged",
          description:
            locale === "fr"
              ? "Toutes les données personnelles et fichiers ont été supprimés."
              : "All personal data and storage files have been permanently deleted.",
        });
        void fetchRequests();
      }
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Execution failed",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending_confirmation":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {locale === "fr" ? "En attente confirmation" : "Pending Confirmation"}
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="outline" className="text-orange-500 border-orange-500/40 bg-orange-500/10 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            {locale === "fr" ? "Confirmé (24h)" : "Confirmed (24h)"}
          </Badge>
        );
      case "processed":
        return (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {locale === "fr" ? "Purgé" : "Purged"}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {locale === "fr" ? "Annulé" : "Cancelled"}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            {locale === "fr" ? "Demandes de suppression de compte (Loi 25)" : "Account Deletion Requests (Law 25)"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === "fr"
              ? "Gérez les demandes de suppression et purgez définitivement les comptes après confirmation et délai de 24 heures."
              : "Manage account deletion requests and execute permanent purges after confirmation and the 24-hour grace window."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchRequests()} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {locale === "fr" ? "Actualiser" : "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {locale === "fr" ? "Aucune demande de suppression enregistrée." : "No deletion requests recorded."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="py-3 px-3">User ID</th>
                <th className="py-3 px-3">{locale === "fr" ? "Statut" : "Status"}</th>
                <th className="py-3 px-3">{locale === "fr" ? "Demandé le" : "Requested At"}</th>
                <th className="py-3 px-3">{locale === "fr" ? "Suppression programmée" : "Scheduled Delete"}</th>
                <th className="py-3 px-3 text-right">{locale === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((r) => {
                const isConfirmed = r.status === "confirmed";
                const isScheduledReady =
                  isConfirmed && r.scheduled_delete_at && new Date() >= new Date(r.scheduled_delete_at);
                const isProcessed = r.status === "processed";

                return (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs">
                      {r.user_id}
                      {r.reason && (
                        <span className="block text-[11px] text-muted-foreground font-sans mt-0.5">
                          {r.reason}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">{statusBadge(r.status)}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {new Date(r.requested_at).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {r.scheduled_delete_at ? (
                        <span className={isScheduledReady ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          {new Date(r.scheduled_delete_at).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}
                          {isScheduledReady ? " (Ready)" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {!isProcessed && r.status !== "cancelled" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actingId === r.id}
                          onClick={() => void handleExecute(r)}
                          className="h-8 text-xs gap-1"
                        >
                          {actingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          {locale === "fr" ? "Purger maintenant" : "Purge Now"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {isProcessed ? (locale === "fr" ? "Terminé" : "Completed") : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

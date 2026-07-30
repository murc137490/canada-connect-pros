import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Briefcase, Loader2, MapPin, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { contentUnavailableLabel, isContentBlocked } from "@/lib/contentModeration";
import { purgeStaleJobRequests } from "@/lib/purgeStaleJobRequests";
import type { JobRemovalReason } from "@/lib/jobRequestRules";
import StorageDisplayImage from "@/components/StorageDisplayImage";

const PHOTOS_BUCKET = "job-request-photos";

type AdminJobRow = {
  id: string;
  description: string;
  category: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  photo_urls: string[] | null;
  budget_range: string | null;
  timing: string | null;
  status: string;
  created_at: string;
  client_id: string;
  profiles: {
    full_name: string | null;
    public_user_number: string | null;
  } | null;
};

export default function AdminJobRequests() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const { toast } = useToast();
  const { isPlatformAdmin, ready } = usePlatformAdmin();
  const waitingForAdminProfile = !!user && !ready && !isPlatformAdmin;

  const [rows, setRows] = useState<AdminJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<AdminJobRow | null>(null);
  const [removeReason, setRemoveReason] = useState<JobRemovalReason>("redo");
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await purgeStaleJobRequests();
    } catch {
      // Never block listing if purge fails
    }
    const { data, error } = await supabase
      .from("job_requests")
      .select(
        "id, description, category, city, province, postal_code, photo_urls, budget_range, timing, status, created_at, client_id",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      toast({ title: t.auth?.toastError ?? "Error", description: error.message, variant: "destructive" });
      setRows([]);
      setLoading(false);
      return;
    }
    const jobs = (data ?? []) as Omit<AdminJobRow, "profiles">[];
    const clientIds = [...new Set(jobs.map((j) => j.client_id))];
    const profileByUser: Record<string, { full_name: string | null; public_user_number: string | null }> = {};
    if (clientIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, public_user_number")
        .in("user_id", clientIds);
      (profs ?? []).forEach((p: { user_id: string; full_name: string | null; public_user_number: string | null }) => {
        profileByUser[p.user_id] = {
          full_name: p.full_name,
          public_user_number: p.public_user_number,
        };
      });
    }
    setRows(
      jobs.map((j) => ({
        ...j,
        profiles: profileByUser[j.client_id] ?? null,
      })),
    );
    setLoading(false);
  }, [t.auth?.toastError, toast]);

  useEffect(() => {
    if (!user || !isPlatformAdmin || waitingForAdminProfile) return;
    void load();
  }, [user, isPlatformAdmin, waitingForAdminProfile, load]);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const { data, error } = await supabase.rpc("moderate_job_request_admin", {
        p_request_id: removeTarget.id,
        p_reason: removeReason,
      });
      if (error) throw error;
      const blocked = (data as { blocked?: boolean } | null)?.blocked === true;
      toast({
        title: t.dashboard.adminJobRemoved ?? "Request removed",
        description: blocked
          ? (t.dashboard.adminJobRemovedBlocked ?? "Client reached 3 strikes and is blocked from new requests.")
          : (t.dashboard.adminJobRemovedDesc ?? "The client was notified."),
      });
      setRemoveTarget(null);
      setRemoveReason("redo");
      await load();
    } catch (e) {
      toast({
        title: t.auth?.toastError ?? "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (waitingForAdminProfile) {
    return (
      <Layout>
        <div className="container flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }
  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container max-w-4xl py-8 px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase size={24} />
            {t.dashboard.adminJobRequestsTitle ?? "Available jobs (all areas)"}
          </h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard?tab=admin">{t.dashboard.adminBack ?? "Back to admin"}</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {t.dashboard.adminJobRequestsBlurb ??
            "Review open client requests from every region. Removing sends the client a notice. Inappropriate or suspicious removals apply strikes (3 strikes blocks new requests)."}
        </p>

        <div className="rounded-xl border bg-card p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.dashboard.adminJobRequestsEmpty ?? "No open requests right now."}
            </p>
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => {
                const blocked = isContentBlocked(row.description);
                return (
                  <li key={row.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{row.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => {
                          setRemoveTarget(row);
                          setRemoveReason("redo");
                        }}
                      >
                        <Trash2 size={14} />
                        {t.dashboard.adminJobRemove ?? "Remove"}
                      </Button>
                    </div>

                    <p className="text-xs font-mono text-muted-foreground break-all">Request ID: {row.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.dashboard.accountMemberId ?? "Member ID"}:{" "}
                      {row.profiles?.public_user_number ?? "—"} · {row.profiles?.full_name ?? "Client"}
                    </p>

                    {(row.city || row.postal_code) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin size={12} />
                        {[row.postal_code, row.city, row.province].filter(Boolean).join(", ")}
                      </p>
                    )}

                    {row.budget_range ? (
                      <p className="text-xs text-muted-foreground">Budget: {row.budget_range}</p>
                    ) : null}

                    {blocked ? (
                      <p className="text-sm rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                        {contentUnavailableLabel(locale)}
                      </p>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{row.description}</p>
                    )}

                    {Array.isArray(row.photo_urls) && row.photo_urls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.photo_urls.map((url, i) =>
                          blocked || isContentBlocked(url) ? (
                            <div
                              key={`${url}-${i}`}
                              className="h-20 w-20 rounded-md border bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center p-1"
                            >
                              {contentUnavailableLabel(locale)}
                            </div>
                          ) : (
                            <a
                              key={`${url}-${i}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-20 w-20 rounded-md border overflow-hidden"
                            >
                              <StorageDisplayImage
                                bucket={PHOTOS_BUCKET}
                                url={url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ),
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.dashboard.adminJobRemoveTitle ?? "Remove this request?"}</DialogTitle>
            <DialogDescription>
              {t.dashboard.adminJobRemoveDesc ??
                "The client will receive a notification. Choose a reason below."}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={removeReason}
            onValueChange={(v) => setRemoveReason(v as JobRemovalReason)}
            className="space-y-2"
          >
            <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
              <RadioGroupItem value="inappropriate" className="mt-0.5" />
              <span>
                <span className="font-medium block">{t.dashboard.adminJobReasonInappropriate ?? "Inappropriate"}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.adminJobReasonInappropriateHint ?? "Counts as a strike (3 strikes = ban)."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
              <RadioGroupItem value="suspicious" className="mt-0.5" />
              <span>
                <span className="font-medium block">{t.dashboard.adminJobReasonSuspicious ?? "Suspicious activity"}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.adminJobReasonSuspiciousHint ?? "Counts as a strike (3 strikes = ban)."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
              <RadioGroupItem value="redo" className="mt-0.5" />
              <span>
                <span className="font-medium block">{t.dashboard.adminJobReasonRedo ?? "Redo the request"}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.adminJobReasonRedoHint ?? "No strike — ask the client to submit again properly."}
                </span>
              </span>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              {t.common.cancel ?? "Cancel"}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRemove()} disabled={removing}>
              {removing ? <Loader2 size={14} className="animate-spin" /> : null}
              {t.dashboard.adminJobConfirmRemove ?? "Remove & notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}


